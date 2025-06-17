const fs = require("fs");
const path = require("path");
// fileName : server.js 
// Example using the http module
const http = require('http');
const express = require('express');
const mysql = require('mysql2');
//const mysql = require('mysql2/promise'); 
const cors = require('cors');
// Specify the port to listen on
const port =  process.env.PORT || 3002;

const app = express();
app.use(cors());
//const open = require('open');  // Import the open package
const bodyParser = require('body-parser'); // To parse JSON request bodies
// Middleware to parse incoming JSON request bodies
app.use(bodyParser.json());


// Serve static files (optional if you want to serve HTML from the server)
app.use(express.static('public'));

// Create an HTTP server
const server = http.createServer((req, res) => {
    // Set the response headers
    res.writeHead(200, { 'Content-Type': 'text/html' });

    // Write the response content
    res.write('<h1>Hello, Node.js HTTP Server!</h1>');
    res.end();
});

// MySQL Database connection setup
const connection = mysql.createConnection({
    host: '103.21.58.4',          // MySQL server address
    user: 'saralaccountsuser',               // MySQL username
    password: 'saral@accounts',               // MySQL password (if any)
    database: 'saralaccounts_db', 
    port:3306,
      multipleStatements: true   // Your database name
  });
  
  // Check connection to MySQL
 connection.connect(err => {
    if (err) {
      console.error('Error connecting to the database:', err.stack);
      return;
    }
    console.log('Connected to MySQL database.');
  });


// Create folder if it doesn't exist
const qrFolder = path.join(__dirname, "uploadsQR");
if (!fs.existsSync(qrFolder)) {
  fs.mkdirSync(qrFolder, { recursive: true });
}

// Middleware to serve QR folder as static
app.use("/uploadsQR", express.static(qrFolder));

// Route to save QR Code
app.post("/uploadQR", (req, res) => {
  const { loginID, qrImage } = req.body;

  if (!loginID || !qrImage) {
    return res.status(400).json({ error: "Missing loginID or qrImage" });
  }

  const base64Data = qrImage.replace(/^data:image\/(png|jpeg|jpg);base64,/, "");
  const fileName = `${loginID}.jpg`;
  const filePath = path.join(qrFolder, fileName);

  fs.writeFile(filePath, base64Data, "base64", (err) => {
    if (err) {
      console.error("Error saving QR image:", err);
      return res.status(500).json({ error: "Failed to save QR image" });
    }

    res.json({
      message: "QR image saved successfully",
      filename: fileName,
      path: `/uploadsQR/${fileName}`,
    });
  });
});






// Root route (optional)
app.get('/check', (req, res) => {
  res.send('Welcome to the API! of Saral Accounts.');
});










app.post("/insertLogin", (req, res) => {
    const { businessName, phoneNumber, password } = req.body;
  
    if (!businessName || !phoneNumber || !password) {
      return res.status(400).json({ error: "All fields are required" });
    }
  
    // Call the stored procedure
    const sql = "CALL insertLogin(?, ?, ?)";
    connection.query(sql, [businessName, phoneNumber, password], (err, result) => {
      if (err) {
        console.error("Error executing stored procedure:", err);

        if (err.code === "ER_DUP_ENTRY") {
          return res.status(409).json({ error: "Phone number already exists!" });
      }

        return res.status(500).json({ error: "Database error" });
      }
      res.status(200).json({ message: "User registered successfully!" });
    });
  });


  app.post("/login", (req, res) => {
    const { PhoneNumber, Password } = req.body;
  
    if (!PhoneNumber || !Password) {
      return res.status(400).json({ error: "Phone number and password are required" });
    }
  
    // Call Stored Procedure with both parameters
    connection.query("CALL checkLogin(?, ?)", [PhoneNumber, Password], (err, results) => {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).json({ error: "Database error" });
      }
  
      // Check if user exists
      if (results[0].length === 0) {
        return res.status(401).json({ error: "Invalid phone number or password" });
      }

//       setTimeout(() => {
//   const user = results[0][0];
//   res.json({
//     message: "Login successful",
//     LoginID: user.LoginID,
//     Role: user.Role,
//     Interest_enabled: user.Interest_enabled,
//     WA_API: user.WA_API,
//   });
// }, 3000);
  
       const user = results[0][0];
       res.json({ message: "Login successful", LoginID: user.LoginID,Role: user.Role ,Interest_enabled: user.Interest_enabled,WA_API: user.WA_API ,Payment_reminder: user.Payment_reminder  });
    });
  });


 app.post("/addCustomer", (req, res) => {
  const { name, mobile, address, fLoginID, date, amount, type, interest } = req.body;

  if (!name || !mobile || !fLoginID) {
    return res.status(400).json({ error: "Name, Mobile, and Login ID are required!" });
  }

  if (!/^\d{10}$/.test(mobile)) {
    return res.status(400).json({ error: "Mobile number must be 10 digits!" });
  }

  const formattedDate = date || new Date().toISOString().split("T")[0];

  const query = `CALL addCustomers(?, ?, ?, ?, ?, ?, ?, ?)`;

  connection.query(
    query,
    [name, mobile, address, fLoginID, formattedDate, amount || null, type, interest],
    (err, result) => {
      if (err) {
        if (err.code === "ER_DUP_ENTRY") {
          // Check for the specific unique key causing the error
          if (err.sqlMessage.includes("mobileLoginid")) {
            return res.status(409).json({ error: "This mobile number is already registered." });
          }
            if (err.sqlMessage.includes("nameloginid")) {
            return res.status(409).json({ error: "This customer name is already registered." });
          }
          return res.status(409).json({ error: "Duplicate entry." });
        }

        console.error("Error inserting customer:", err);
        return res.status(500).json({ error: "Server error while adding customer." });
      }

      res.status(201).json({ message: "Customer added successfully!" });
    }
  );
});


app.delete("/deleteQR/:loginID", (req, res) => {
  const loginID = req.params.loginID;
  if (!loginID) {
    return res.status(400).json({ error: "loginID is required" });
  }

  const filePath = path.join(qrFolder, `${loginID}.jpg`);

  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      return res.status(404).json({ error: "QR image not found" });
    }

    fs.unlink(filePath, (err) => {
      if (err) {
        console.error("Error deleting QR image:", err);
        return res.status(500).json({ error: "Failed to delete QR image" });
      }

      res.json({ message: "QR image deleted successfully" });
    });
  });
});

  app.get("/customers/:loginID", (req, res) => {
    const loginID = req.params.loginID;
    
  if (!loginID || loginID.trim() === "") {
    return res.status(400).json({ error: "Login ID is required!" });
  }

    const query = "CALL GetCustomersByLogin(?)"; // Calling the stored procedure
    connection.query(query, [loginID], (err, results) => {
      if (err) {
        console.error("Error fetching customers:", err); 
        return res.status(500).json({ error: "Internal Server Error" });
      }
      res.json(results[0]); // MySQL stored procedures return results in an array
    });
  });

  app.get("/customers/simple/:loginID", (req, res) => {
    const loginID = req.params.loginID;
 if (!loginID || loginID.trim() === "") {
    return res.status(400).json({ error: "Login ID is required!" });
  }

    const query = "CALL GetCustomerListByLogin(?)"; // new stored procedure

    connection.query(query, [loginID], (err, results) => {
        if (err) {
            console.error("Error fetching simple customers:", err);
            return res.status(500).json({ error: "Internal Server Error" });
        }
        res.json(results[0]);
    });
});
  

app.delete("/customers/:id", (req, res) => {
  const customerID = req.params.id;

 if (!customerID || isNaN(customerID)) {
    return res.status(400).json({ error: "Valid customer ID is required!" });
  }

  const sql = "CALL DeleteCustomerByID(?)";

  connection.query(sql, [customerID], (err, result) => {
    if (err) {
      console.error("Error deleting customer:", err);
      return res.status(500).json({ error: "Failed to delete customer" });
    }

    res.status(200).json({ message: " deleted successfully" });
  });
});


app.put("/updateCustomer/:id", (req, res) => {
  const id = req.params.id;

  if (!id || isNaN(id)) {
    return res.status(400).json({ error: "Valid customer ID is required!" });
  }

  const { name, mobile, address, date, amount, type,interest } = req.body;

  if (!name || name.trim() === '') {
    return res.status(400).json({ error: "Name is required and cannot be blank" });
  }
  if (!mobile || mobile.trim() === '') {
    return res.status(400).json({ error: "Mobile is required and cannot be blank" });
  }
  if (!type || type.trim() === '') {
    return res.status(400).json({ error: "Type is required and cannot be blank" });
  }

  const sql = "CALL updateCustomer(?, ?, ?, ?,?,?,?,?)";
  connection.query(sql, [id, name, mobile, address, date, amount || null, type,interest ], (err, results) => {
    if (err) {
      console.error("Update error:", err);
      return res.status(500).json({ error: "Failed to update customer" });
      
    }

    
    res.status(200).json({ message: " updated successfully" });
  });
});


app.post("/accounts", (req, res) => {
  console.log("hi");
    const { date, customerID,oppositeCustomerID, amount, type, narration,days } = req.body;

 // Basic validation
  if (!date || date.trim() === '') {
    return res.status(400).json({ error: "Date is required and cannot be blank" });
  }
  if (!customerID || customerID.toString().trim() === '') {
    return res.status(400).json({ error: "customerID is required and cannot be blank" });
  }
  if (!amount || isNaN(amount)) {
    return res.status(400).json({ error: "Valid amount is required" });
  }
  if (!type || type.trim() === '') {
    return res.status(400).json({ error: "Type is required and cannot be blank" });
  }

console.log("show",oppositeCustomerID);
    const query = "CALL InsertAccountTransaction(?, ?, ?, ?, ?,?,?)";
    connection.query(query, [date, customerID,oppositeCustomerID || 0, amount, type, narration,days], (err, results) => {
        if (err) {
            console.error("Error inserting transaction:", err);
            return res.status(500).json({ error: "Internal Server Error" });
        }
        res.status(201).json({ message: "Transaction added successfully" });
    });
});


app.get('/getAccountsByDate/:loginID/:selectedDate', (req, res) => {
  const { loginID, selectedDate } = req.params;

  const sql = `CALL GetAccountsBySingleDate(?, ?)`;

  connection.query(sql, [loginID, selectedDate], (err, result) => {
      if (err) {
          console.log(err);
          res.status(500).send('Error fetching data');
      } else {
        console.log(result[0]);
         // res.send(result[0]);
         const formattedResult = result[0].map(item => ({
          ...item,
          Date: item.Date ? new Date(item.Date).toLocaleDateString('en-CA') : null
        }));
    
        res.json(formattedResult);



      }
  });
});

app.delete('/deleteAccount/:AccountsID', (req, res) => {
  const { AccountsID } = req.params;

   if (!AccountsID || isNaN(AccountsID)) {
    return res.status(400).json({ success: false, message: "Valid AccountsID is required" });
  }


  const sql = `CALL DeleteAccount(?)`;

  connection.query(sql, [AccountsID], (err, results) => {
    if (err) {
      console.error("Delete error:", err);
      return res.status(500).json({ success: false, message: err.message });
    }

    const result = results[0]?.[0];
    const message = result?.message || "Account deleted successfully.";
    const status = result?.status || "success";

    return res.status(200).json({ success: status === "success", status, message });
  });
});


app.post('/accounts', (req, res) => {
  const { AccountsID = 0, date, customerID, amount, narration, type,days } = req.body;

  const sql = `CALL InsertOrUpdateAccount(?, ?, ?, ?, ?, ?,?)`;

  connection.query(sql, [AccountsID, date, customerID, amount, narration, type,days], (err, result) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ success: false, message: "Database error!" });
    }
    res.json({ success: true, message:"Transaction Updated" });
  });
});
app.put('/updateAccount/:AccountsID', (req, res) => {
  const { AccountsID } = req.params;
  const { date, customerID,oppositeCustomerID, amount, narration, type,days } = req.body;

    // Validate AccountsID param
  if (!AccountsID || isNaN(AccountsID)) {
    return res.status(400).json({ success: false, message: "Valid AccountsID is required!" });
  }

  // Validate required body fields
  if (!date || date.trim() === '') {
    return res.status(400).json({ success: false, message: "Date is required and cannot be blank" });
  }
  if (!customerID || customerID.toString().trim() === '') {
    return res.status(400).json({ success: false, message: "CustomerID is required and cannot be blank" });
  }
  if (!amount || isNaN(amount)) {
    return res.status(400).json({ success: false, message: "Valid amount is required" });
  }
  if (!type || type.trim() === '') {
    return res.status(400).json({ success: false, message: "Type is required and cannot be blank" });
  }

  const sql = `CALL UpdateAccount(?, ?, ?, ?, ?, ?,?,?)`;

  connection.query(sql, [AccountsID, date, customerID,oppositeCustomerID || 0, amount, narration, type,days], (err, result) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ success: false, message: "Database Error!" });
    }


    const results= result[0]?.[0];
    const status = results?.status || "success";
    const message = results?.message || "Updated Successfully!";

    return res.status(200).json({ success: status === "success", status, message });

   // res.json({ success: true, message: " Updated Successfully!" });
  });
});
app.get("/getCustomerFinalBalance/:loginID", (req, res) => {
  const loginID = req.params.loginID;
  const tillDate = req.query.tillDate || new Date().toISOString().split("T")[0];


    if (!loginID || loginID.trim() === '') {
    return res.status(400).json({ success: false, message: "loginID is required and cannot be blank" });
  }

  const query = `CALL GetCustomerFinalBalance(?, ?)`;

  connection.query(query, [loginID, tillDate], (err, result) => {
    if (err) {
      console.error("Error fetching customer final balance:", err);
      return res.status(500).json({ success: false, message: "Internal Server Error" });
    }

    return res.status(200).json({
      success: true,
      data: result[0]
    });
  });
});



app.get("/getPartyBalance/:loginID/:customerID", (req, res) => {
  const loginID = req.params.loginID;
  const customerID = req.params.customerID;
  
  if (!loginID || loginID.trim() === "" || !customerID || customerID.trim() === "") {
    return res.status(400).json({
      success: false,
      message: "loginID and customerID are required and cannot be blank"
    });
  }

  const query = "CALL GetBalanceOfSingleParty(?, ?)";
  connection.query(query, [loginID, customerID], (err, result) => {
    if (err) {
      console.error("Error fetching party balance:", err);
      return res.status(500).json({ success: false, message: "Internal Server Error" });
    }

    const rows = Array.isArray(result[0]) ? result[0] : [];
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "No record found for this party" });
    }

   const { Mobile: mobile, BusinessName: business, Balance: balance } = rows[0];
res.status(200).json({
  success: true,
  data: { mobile, business, balance: Number(balance) }
});

  });
});



// app.post('/getAccountSummary', async (req, res) => {
//   const { loginID, customerID, fromDate, toDate } = req.body;

//   const query = `CALL GetAccountSummary(?, ?, ?, ?)`;

//   connection.query(query, [loginID, customerID, fromDate, toDate], (err, result) => {
//     if (err) {
//       console.error("Error fetching summary:", err);
//       return res.status(500).json({ error: 'Internal Server Error' });
//     }
//     res.json(result[0]); // result[0] contains rows from stored procedure
//   });
// });
app.post('/getAccountSummary', async (req, res) => {
  const { loginID, customerID, fromDate, toDate } = req.body;

    if (!loginID || loginID.trim() === '') {
    return res.status(400).json({ error: "loginID is required and cannot be blank" });
  }
  if (!customerID || customerID.toString().trim() === '') {
    return res.status(400).json({ error: "customerID is required and cannot be blank" });
  }
  if (!fromDate || fromDate.trim() === '') {
    return res.status(400).json({ error: "fromDate is required and cannot be blank" });
  }
  if (!toDate || toDate.trim() === '') {
    return res.status(400).json({ error: "toDate is required and cannot be blank" });
  }

  const query = `CALL GetAccountSummary(?, ?, ?, ?)`;

  connection.query(query, [loginID, customerID, fromDate, toDate], (err, result) => {
    if (err) {
      console.error("Error fetching summary:", err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }

    const formattedResult = result[0].map(item => ({
      ...item,
      Date: item.Date ? new Date(item.Date).toLocaleDateString('en-CA') : null
    }));

    res.json(formattedResult);
  });
});
app.post('/getOpeningBalance', (req, res) => {
  const { loginID, customerID, fromDate } = req.body;

  if (!loginID || !customerID || !fromDate) {
      return res.status(400).send({ message: "Missing required fields" });
  }

  const sql = 'CALL GetOpeningBalance(?, ?, ?)';

  connection.query(sql, [loginID, customerID, fromDate], (err, result) => {
      if (err) {
          console.log("Error:", err);
          return res.status(500).send({ message: "Database Error", error: err });
      }

      res.send(result[0][0]);  // returning OpeningBalance value
  });
});

app.post('/getDayBook', (req, res) => {
  const { loginID, fromDate, toDate } = req.body;

if (!loginID || loginID.trim() === '') {
    return res.status(400).json({ error: "loginID is required and cannot be blank" });
  }
  if (!fromDate || fromDate.trim() === '') {
    return res.status(400).json({ error: "fromDate is required and cannot be blank" });
  }
  if (!toDate || toDate.trim() === '') {
    return res.status(400).json({ error: "toDate is required and cannot be blank" });
  }


  const sql = `CALL GetDayBook(?, ?, ?)`;

  connection.query(sql, [loginID, fromDate, toDate], (err, results) => {
    if (err) return res.status(500).send(err);
    res.json(results[0]); 
  });
});

app.post('/getOpeningBalanceDayBook', (req, res) => {
  const { loginID, fromDate } = req.body;
  const sql = `CALL GetOpeningBalanceDayBook(?, ?)`;

  connection.query(sql, [loginID, fromDate], (err, results) => {
    if (err) return res.status(500).send(err);
    console.log( err);
    res.json(results[0][0]); 
  });
});

app.post('/postInterest', (req, res) => {
  const { customerID, amount, date } = req.body;

  if (!customerID || amount === undefined || !date) {
    return res.status(400).json({ message: 'Customer ID, amount, and date are required.' });
  }

  const query = `CALL PostInterest(?, ?, ?)`;

  connection.query(query, [customerID, amount, date], (err, results) => {
    if (err) {
      console.error('Error executing stored procedure:', err);
      return res.status(500).json({ message: 'Failed to post interest.' });
    }

    const msg = results?.[0]?.[0]?.message || 'Interest posted successfully.';
    return res.json({ message: msg });
  });
});

// Get firm details by login ID
app.get('/getFirmDetails/:loginID', (req, res) => {
  const { loginID } = req.params;

  if (!loginID || loginID.trim() === '') {
    return res.status(400).json({ error: 'LoginID is required and cannot be blank' });
  }

  const sql = 'CALL GetFirmDetailsByLoginID(?)';

  connection.query(sql, [loginID], (err, results) => {
    if (err) {
      console.error('Error executing stored procedure:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    // Assuming the procedure returns one row of firm details
    const firmDetails = results?.[0]?.[0];

    if (!firmDetails) {
      return res.status(404).json({ error: 'Firm details not found for the given LoginID' });
    }

    res.json(firmDetails);
  });
});

app.put('/updateFirmDetails/:loginID', (req, res) => {
  const { loginID } = req.params;
  const {
    BusinessName,
    PhoneNumber,
    ValidityDate,
    InterestEnable,
    PaymentReminder,
    UPI,
  } = req.body;

  if (!BusinessName || !PhoneNumber || !ValidityDate) {
    return res.status(400).json({ error: 'Required fields cannot be null.' });
  }

  const sql = 'CALL UpdateFirmDetailsByLoginID(?, ?, ?, ?, ?, ?, ?)';
  const values = [loginID, BusinessName, PhoneNumber, ValidityDate, InterestEnable, PaymentReminder, UPI];

  connection.query(sql, values, (err, results) => {
    if (err) {
      console.error('Error executing procedure:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    // ✅ Delete QR image if UPI is empty or null
    if (!UPI || UPI.trim() === "") {
      const qrPath = path.join(__dirname, 'uploadsQR', `${loginID}.jpg`);
      
      fs.access(qrPath, fs.constants.F_OK, (err) => {
        if (!err) {
          fs.unlink(qrPath, (err) => {
            if (err) {
              console.error('Error deleting QR image:', err);
            } else {
              console.log(`QR image deleted for loginID ${loginID}`);
            }
          });
        }
      });
    }

    res.json({ message: 'Firm details updated successfully' });
  });
});



app.get('/getWaStatus/:loginID', (req, res) => {
  const { loginID } = req.params;

   if (!loginID || loginID.trim() === '') {
    return res.status(400).json({ error: 'LoginID is required and cannot be blank' });
  }

  const sql = 'CALL GetWAStatus(?)';

  connection.query(sql, [loginID], (err, results) => {
    if (err) {
      console.error("Error calling stored procedure:", err);
      return res.status(500).json({ error: 'Internal server error' });
    }

    // results[0] contains the result set from the SELECT query
    if (results[0].length > 0) {
      res.json({ WA_enabled: results[0][0].WA_enabled });
    } else {
      res.status(404).json({ error: "Login ID not found" });
    }
  });
});

app.post('/change-password', (req, res) => {
  const { phoneNumber, oldPassword, newPassword } = req.body;

  if (!phoneNumber || !oldPassword || !newPassword) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  // SQL to call the stored procedure and retrieve the result
  const sql = `CALL ChangePassword(?, ?, ?, @result); SELECT @result AS message;`;

  connection.query(sql, [phoneNumber, oldPassword, newPassword], (err, results) => {
    if (err) {
      console.error('DB Error:', err);
      return res.status(500).json({ message: 'Database error' });
    }

    // The first result set is from the CALL, and the second is the SELECT @result
    const resultMessage = results[1][0].message;

    if (resultMessage === 'Password changed successfully') {
      return res.json({ success: true, message: resultMessage });
    } else {
      return res.status(401).json({ success: false, message: resultMessage });
    }
  });
});


app.get('/getPhoneNumber/:loginID', (req, res) => {
  const { loginID } = req.params;

    if (!loginID || loginID.trim() === '') {
    return res.status(400).json({ error: 'LoginID is required and cannot be blank' });
  }

  const sql = 'CALL GetPhoneNumberByLoginID(?)';

  connection.query(sql, [loginID], (err, results) => {
    if (err) {
      console.error('Error fetching phone number:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    // Assuming results[0] contains the query result with the phone number
    if (results[0].length === 0) {
      return res.status(404).json({ error: 'Phone number not found for given LoginID' });
    }

    const phoneNumber = results[0][0].PhoneNumber;
    res.json({ phoneNumber });
  });
});

app.post("/insertAdminLogin", (req, res) => {
  const {
    businessName,
    phoneNumber,
    password,
    isEnable,
    validityDate,
    WA_API,
    WA_enabled,
    InterestEnable,
    PaymentReminder, // ✅ added
    bankDetails,
  } = req.body;

  if (
    !businessName ||
    !phoneNumber ||
    !password ||
    validityDate === undefined ||
    WA_API === undefined ||
    isEnable === undefined ||
    WA_enabled === undefined ||
    InterestEnable === undefined ||
    PaymentReminder === undefined // ✅ added
  ) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const sql = "CALL insertAdminLogin(?, ?, ?, ?, ?, ?, ?, ?, ?,?)"; // ✅ updated

  connection.query(
    sql,
    [
      businessName,
      phoneNumber,
      password,
      isEnable,
      validityDate,
      WA_API,
      WA_enabled,
      InterestEnable,
      PaymentReminder, // ✅ added
      bankDetails, // ✅ added
    ],
    (err, result) => {
      if (err) {
        console.error("Error executing stored procedure:", err);
        if (err.code === "ER_DUP_ENTRY") {
          return res.status(409).json({ error: "Phone number already exists." });
        }
        return res.status(500).json({ error: "Database error" });
      }
      res.status(200).json({ message: "User registered successfully!" });
    }
  );
});


app.get("/getAdminLogins", (req, res) => {
  const sql = "CALL GetAllAdmins()";

  connection.query(sql, (err, results) => {
  if (err) {
  console.error("Error executing stored procedure:", err);

  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ error: "Phone number already exists." });
  }

  return res.status(500).json({ error: "Database error" });
}

    // Assuming results[0] contains the result set from the stored procedure
    res.json(results[0]);
  });
});


app.put("/updateAdmin/:id", (req, res) => {
  const id = req.params.id;

 if (!id || isNaN(id)) {
    return res.status(400).json({ error: "Valid admin ID is required!" });
  }

  const {
    businessName,
    phoneNumber,
    password,
    isEnable,
    validityDate,
    WA_API,
    WA_enabled,
    InterestEnable,
    Payment_reminder,
    UPI,
     bankDetails,
  } = req.body;

   if (!phoneNumber || phoneNumber.trim() === '' || !password || password.trim() === '') {
    return res.status(400).json({ error: "Phone number and password cannot be blank" });
  }

  const sql = "CALL updateAdmin(?, ?, ?, ?, ?, ?, ?, ?,?,?,?,?)";
  connection.query(
    sql,
    [id, businessName, phoneNumber, password, isEnable, validityDate, WA_API, WA_enabled, InterestEnable,Payment_reminder,UPI, bankDetails],
    (err, results) => {
      if (err) {
        console.error("Update admin error:", err);
        return res.status(500).json({ error: "Failed to update admin" });
      }

      res.status(200).json({ message: "Admin updated successfully" });
    }
  );
});

app.delete('/deleteAdmin/:phoneNumber', (req, res) => {
  const phone = req.params.phoneNumber;

    if (!phone || phone.trim() === '') {
    return res.status(400).json({ error: 'Phone number is required and cannot be blank' });
  }

  connection.query('CALL DeleteAdminByPhone(?)', [phone], (err, results) => {
    if (err) {
      console.error('Error calling stored procedure:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    const affectedRows = results?.[0]?.[0]?.affectedRows || 0;

    if (affectedRows === 0) {
      return res.status(404).json({ error: 'Admin not found or already deleted.' });
    }

    res.json({ message: 'Admin deleted successfully' });
  });
});


app.post('/ledgerReportByPhone', (req, res) => {
  const phone = req.body.phone;

  if (!phone) {
    return res.status(400).json({ error: 'Phone number is required.' });
  }

  connection.query('CALL GetLedgerDetailsByPhone(?)', [phone], (err, results) => {
    if (err) {
      console.error('Error calling stored procedure:', err);
      return res.status(500).json({ error: 'Database error.' });
    }

    const data = results?.[0];

    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'No data found for the provided phone number.' });
    }

    res.json(data);
  });
});

app.post('/getBusinessesByPhone', (req, res) => {
  const phone = req.body.phone;

  if (!phone) {
    return res.status(400).json({ error: 'Phone number is required.' });
  }

  connection.query('CALL GetBusinessByPhone(?)', [phone], (err, results) => {
    if (err) {
      console.error('Error calling stored procedure:', err);
      return res.status(500).json({ error: 'Database error.' });
    }

    const data = results?.[0];

    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'No businesses found for this phone number.' });
    }

    res.json(data);
  });
});

app.get('/getPaymentReminder/:loginID/:tillDate', (req, res) => {
  const { loginID, tillDate } = req.params;

  const sql = `CALL GetPaymentReminderDetails(?, ?)`;

  connection.query(sql, [loginID, tillDate], (err, result) => {
    if (err) {
      console.error('MySQL Error:', err);
      return res.status(500).send('Error fetching payment reminder data');
    }

    // Format Date & DueDate for consistency (e.g., YYYY-MM-DD)
    const formattedResult = result[0].map(item => ({
      ...item,
      Date: item.Date ? new Date(item.Date).toLocaleDateString('en-CA') : null,
      DueDate: item.DueDate ? new Date(item.DueDate).toLocaleDateString('en-CA') : null
    }));

    res.json(formattedResult);
  });
});




const util = require("util");
const query = util.promisify(connection.query).bind(connection);






  


process.on("SIGTERM", () => {
  if (server) {
    server.close(() => {
      console.log("Server closed");
      process.exit(0);
    });
  }
});



// Start the server
app.listen(port, () => {
    console.log(`Node.js HTTP server is running on port ${port}`);
});
