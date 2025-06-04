const express = require("express");
const mysql = require("mysql2");
const bcrypt = require("bcryptjs");
const exphbs = require("express-handlebars");
const path = require("path");
const session = require("express-session");
require("dotenv").config();

// Import route modules
const authRoutes = require("./routes/auth");
const packageRoutes = require("./routes/packages");
const userRoutes = require("./routes/user");
const hotelRoutes = require("./routes/hotels");
const adminRoutes = require("./routes/admin");
const pageRoutes = require("./routes/pages");

const app = express();
const PORT = 3000;

// Setup Handlebars with helpers
const hbs = exphbs.create({
  extname: "hbs",
  helpers: {
    // Add custom helpers
    json: function(context) {
      return JSON.stringify(context);
    },
    split: function(string, separator) {
      if (typeof string !== 'string') return [];
      return string.split(separator);
    },
    lessThan: function(a, b) {
      return a < b;
    },
    greaterThan: function(a, b) {
      return a > b;
    },
    subtract: function(a, b) {
      return a - b;
    },
    eq: function(a, b) {
      return a === b;
    },
    truncate: function(str, len) {
      if (str && str.length > len) {
        return str.substring(0, len) + '...';
      }
      return str;
    },
    formatDate: function(date) {
      if (!date) return '';
      const d = new Date(date);
      return d.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    },
    formatCurrency: function(amount) {
      return '₹' + Number(amount).toLocaleString('en-IN');
    },
    formatNumber: function(number) {
      return number.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    },
    multiply: function(a, b) {
      return a * b;
    },
    truncate: function(text, length) {
      if (!text) return '';
      if (text.length <= length) return text;
      return text.substring(0, length) + '...';
    }
  }
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));
app.engine("hbs", hbs.engine);
app.set("view engine", "hbs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));

// Session Configuration
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'travel_management_system_secret_key_123',
    resave: true,
    saveUninitialized: true,
    cookie: { 
      secure: false, // Change to true if using HTTPS
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      httpOnly: true
    },
    rolling: true // Reset expiration on each request
  })
);

// MySQL Database Connection
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
});

// Create database connection
const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: process.env.DB_PASS,
  database: 'travelagencydb'
});

// Connect to the database
connection.connect((err) => {
  if (err) {
    console.error('Error connecting to database:', err);
    process.exit(1);
  }

  // Ensure our tables match the schema
  // User table
  db.query(`
    CREATE TABLE IF NOT EXISTS User (
      User_id INT PRIMARY KEY AUTO_INCREMENT,
      Name VARCHAR(100) NOT NULL,
      Email VARCHAR(100) UNIQUE NOT NULL,
      Password VARCHAR(255) NOT NULL,
      MobileNumber VARCHAR(15) UNIQUE NOT NULL,
      Country VARCHAR(50),
      IsAdmin BOOLEAN DEFAULT FALSE
    )
  `, (err) => {
    if (err) {
      console.error("Error checking User table:", err);
    }
  });

  // Packages table
  db.query(`
    CREATE TABLE IF NOT EXISTS Packages (
      PackageId INT PRIMARY KEY AUTO_INCREMENT,
      PackageName VARCHAR(100) NOT NULL,
      PackageLocation VARCHAR(100) NOT NULL,
      PackageDetails TEXT,
      PackagePrice DECIMAL(10,2),
      PackageImage VARCHAR(255),
      Duration INT DEFAULT 7,
      Accommodation VARCHAR(100) DEFAULT '4 Star',
      Features TEXT,
      Categories VARCHAR(255)
    )
  `, (err) => {
    if (err) {
      console.error("Error checking Packages table:", err);
    } else {
      console.log("Packages table checked/created");
      
      // Check if packages exist
      db.query("SELECT COUNT(*) as count FROM Packages", (err, results) => {
        if (err) {
          console.error("Error checking packages count:", err);
          return;
        }
        
        // If no packages exist, add sample packages
        if (results[0].count === 0) {
          console.log("No packages found, adding sample packages...");
          
          const packages = [
            {
              PackageName: "Bali Beach Paradise",
              PackageLocation: "Bali, Indonesia",
              PackageDetails: "Experience the stunning beaches and vibrant culture of Bali with our 7-day luxury package.",
              PackagePrice: 1299.00,
              PackageImage: "https://placehold.co/800x500",
              Duration: 7,
              Accommodation: "4-5 Star",
              Features: "Meals Included,Airport Transfers,Guided Tours",
              Categories: "beaches,family"
            },
            {
              PackageName: "Swiss Alps Adventure",
              PackageLocation: "Switzerland",
              PackageDetails: "Explore the majestic Swiss Alps with hiking, skiing, and breathtaking mountain views.",
              PackagePrice: 1899.00,
              PackageImage: "https://placehold.co/800x500",
              Duration: 10,
              Accommodation: "4 Star",
              Features: "Transportation,Equipment Rental,Professional Guides",
              Categories: "mountains,adventure"
            },
            {
              PackageName: "Kerala Backwaters Bliss",
              PackageLocation: "Kerala, India",
              PackageDetails: "Discover the serene backwaters, lush tea plantations, and pristine beaches of God's Own Country.",
              PackagePrice: 68999.00,
              PackageImage: "https://placehold.co/800x500",
              Duration: 7, 
              Accommodation: "Luxury Resorts",
              Features: "Houseboat Stay,Ayurvedic Treatments,Cultural Programs",
              Categories: "india,beaches"
            },
            {
              PackageName: "Golden Triangle Tour",
              PackageLocation: "Delhi-Agra-Jaipur, India",
              PackageDetails: "Explore India's most iconic destinations including the Taj Mahal, Red Fort, and Amber Palace on this cultural journey.",
              PackagePrice: 55000.00,
              PackageImage: "https://placehold.co/800x500",
              Duration: 6,
              Accommodation: "5 Star",
              Features: "Private Transportation,English-speaking Guide,Monument Entry Fees,Daily Breakfast",
              Categories: "india,culture,heritage"
            },
            {
              PackageName: "Varanasi Spiritual Journey",
              PackageLocation: "Varanasi, India",
              PackageDetails: "Experience the spiritual heart of India with Ganga aarti ceremonies, temple visits, and boat rides on the sacred river.",
              PackagePrice: 35000.00,
              PackageImage: "https://placehold.co/800x500",
              Duration: 4,
              Accommodation: "Heritage Hotels",
              Features: "Boat Rides,Temple Tours,Cultural Performances,Yoga Sessions",
              Categories: "india,spiritual,culture"
            },
            {
              PackageName: "Rajasthan Royal Heritage",
              PackageLocation: "Rajasthan, India",
              PackageDetails: "Live like royalty exploring palaces, forts, and desert landscapes in India's colorful state of Rajasthan.",
              PackagePrice: 75000.00,
              PackageImage: "https://placehold.co/800x500",
              Duration: 8,
              Accommodation: "Palace Hotels",
              Features: "Camel Safari,Sound and Light Shows,Royal Dinners,Cultural Performances",
              Categories: "india,luxury,heritage"
            },
            {
              PackageName: "Himalayan Mountain Retreat",
              PackageLocation: "Himachal Pradesh, India",
              PackageDetails: "Escape to the tranquil mountains with stunning views, adventure activities, and peaceful retreats.",
              PackagePrice: 45000.00,
              PackageImage: "https://placehold.co/800x500",
              Duration: 7,
              Accommodation: "Mountain Resorts",
              Features: "Trekking,Paragliding,River Rafting,Meditation Sessions",
              Categories: "india,mountains,adventure"
            },
            {
              PackageName: "Goa Beach Escape",
              PackageLocation: "Goa, India",
              PackageDetails: "Relax on pristine beaches, enjoy water sports, and experience the unique Indo-Portuguese culture of Goa.",
              PackagePrice: 40000.00,
              PackageImage: "https://placehold.co/800x500",
              Duration: 5,
              Accommodation: "Beach Resorts",
              Features: "Water Sports,Beach Parties,Spice Plantation Visit,Dudhsagar Waterfall Trip",
              Categories: "india,beaches,nightlife"
            }
          ];
          
          // Insert packages
          packages.forEach(pkg => {
            db.query(
              "INSERT INTO Packages (PackageName, PackageLocation, PackageDetails, PackagePrice, PackageImage, Duration, Accommodation, Features, Categories) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
              [pkg.PackageName, pkg.PackageLocation, pkg.PackageDetails, pkg.PackagePrice, pkg.PackageImage, pkg.Duration, pkg.Accommodation, pkg.Features, pkg.Categories],
              (err) => {
                if (err) {
                  console.error("Error inserting package:", err);
                }
              }
            );
          });
          
          console.log("Sample packages added to database");
        }
      });
    }
  });

  // Booking table
  db.query(`
    CREATE TABLE IF NOT EXISTS Booking (
      BookingID INT PRIMARY KEY AUTO_INCREMENT,
      PackageID INT,
      UserEmail VARCHAR(100),
      FromDate DATE,
      ToDate DATE,
      NumberOfPeople INT,
      Status ENUM('Pending', 'Confirmed', 'Cancelled'),
      HotelID INT,
      FOREIGN KEY (PackageID) REFERENCES Packages(PackageId),
      FOREIGN KEY (HotelID) REFERENCES Hotel(Hotel_id)
    )
  `, (err) => {
    if (err) {
      console.error("Error checking Booking table:", err);
    } else {
      console.log("Booking table checked/created");
      
      // Add HotelID column if not exists
      db.query("SHOW COLUMNS FROM Booking LIKE 'HotelID'", (err, results) => {
        if (err) {
          console.error("Error checking Booking table columns:", err);
        } else if (results.length === 0) {
          // HotelID column doesn't exist, add it
          db.query("ALTER TABLE Booking ADD COLUMN HotelID INT, ADD FOREIGN KEY (HotelID) REFERENCES Hotel(Hotel_id)", (err) => {
            if (err) {
              console.error("Error adding HotelID column to Booking table:", err);
            } else {
              console.log("Added HotelID column to Booking table");
            }
          });
        }
      });
    }
  });

  // Hotel table
  db.query(`
    CREATE TABLE IF NOT EXISTS Hotel (
      Hotel_id INT PRIMARY KEY AUTO_INCREMENT,
      HotelName VARCHAR(100) NOT NULL,
      HotelLocation VARCHAR(100) NOT NULL,
      PricePerNight DECIMAL(10,2),
      Ratings FLOAT,
      HotelImage VARCHAR(255),
      Description TEXT,
      Amenities TEXT
    )
  `, (err) => {
    if (err) {
      console.error("Error checking Hotel table:", err);
    } else {
      console.log("Hotel table checked/created");
      
      // Check if hotels exist
      db.query("SELECT COUNT(*) as count FROM Hotel", (err, results) => {
        if (err) {
          console.error("Error checking hotels count:", err);
          return;
        }
        
        // If no hotels exist, add sample hotels
        if (results[0].count === 0) {
          console.log("No hotels found, adding sample hotels...");
          
          const hotels = [
            {
              HotelName: "Ocean View Resort",
              HotelLocation: "Maldives",
              PricePerNight: 500.00,
              Ratings: 4.5,
              HotelImage: "https://placehold.co/600x400",
              Description: "Luxury beachfront resort with stunning ocean views and private villas.",
              Amenities: "Private Beach,Spa,Swimming Pool,Restaurant,Free Wi-Fi,Room Service"
            },
            {
              HotelName: "Alpine Lodge",
              HotelLocation: "Switzerland",
              PricePerNight: 350.00,
              Ratings: 4.7,
              HotelImage: "https://placehold.co/600x400",
              Description: "Cozy mountain retreat with panoramic views of the Swiss Alps.",
              Amenities: "Ski-in/Ski-out,Fireplace,Sauna,Restaurant,Bar,Free Wi-Fi"
            },
            {
              HotelName: "Taj Palace",
              HotelLocation: "Delhi, India",
              PricePerNight: 250.00,
              Ratings: 4.8,
              HotelImage: "https://placehold.co/600x400",
              Description: "Iconic luxury hotel with rich heritage and world-class service.",
              Amenities: "Swimming Pool,Spa,Fine Dining,Concierge,Free Wi-Fi,Valet Parking"
            },
            {
              HotelName: "Gateway Agra",
              HotelLocation: "Agra, India",
              PricePerNight: 180.00,
              Ratings: 4.3,
              HotelImage: "https://placehold.co/600x400",
              Description: "Elegant hotel with Taj Mahal views and beautiful gardens.",
              Amenities: "Taj Mahal View,Swimming Pool,Restaurant,Bar,Free Wi-Fi,Tour Desk"
            },
            {
              HotelName: "Royal Heritage",
              HotelLocation: "Jaipur, India",
              PricePerNight: 210.00,
              Ratings: 4.6,
              HotelImage: "https://placehold.co/600x400",
              Description: "Historic palace converted into a luxury hotel with traditional Rajasthani charm.",
              Amenities: "Heritage Tours,Swimming Pool,Spa,Restaurant,Bar,Cultural Shows"
            },
            {
              HotelName: "Riverside Retreat",
              HotelLocation: "Varanasi, India",
              PricePerNight: 150.00,
              Ratings: 4.2,
              HotelImage: "https://placehold.co/600x400",
              Description: "Peaceful hotel overlooking the sacred Ganges river.",
              Amenities: "River View,Yoga Classes,Meditation Space,Restaurant,Boat Rides,Cultural Tours"
            },
            {
              HotelName: "Desert Palace",
              HotelLocation: "Rajasthan, India",
              PricePerNight: 280.00,
              Ratings: 4.7,
              HotelImage: "https://placehold.co/600x400",
              Description: "Luxurious palace hotel in the heart of the Thar Desert.",
              Amenities: "Desert Safaris,Swimming Pool,Spa,Restaurant,Cultural Programs,Royal Dining"
            },
            {
              HotelName: "Mountain View Resort",
              HotelLocation: "Himachal Pradesh, India",
              PricePerNight: 190.00,
              Ratings: 4.4,
              HotelImage: "https://placehold.co/600x400",
              Description: "Serene mountain resort with breathtaking Himalayan views.",
              Amenities: "Mountain Views,Hiking Trails,Adventure Sports,Restaurant,Bonfire,Spa"
            },
            {
              HotelName: "Goa Beachfront Resort",
              HotelLocation: "Goa, India",
              PricePerNight: 220.00,
              Ratings: 4.5,
              HotelImage: "https://placehold.co/600x400",
              Description: "Vibrant beachfront resort with Portuguese-inspired architecture.",
              Amenities: "Private Beach,Swimming Pool,Water Sports,Beach Bar,Spa,Live Music"
            },
            {
              HotelName: "Kerala Backwater Lodge",
              HotelLocation: "Kerala, India",
              PricePerNight: 230.00,
              Ratings: 4.8,
              HotelImage: "https://placehold.co/600x400",
              Description: "Tranquil eco-lodge nestled along Kerala's famous backwaters.",
              Amenities: "Houseboat Cruises,Ayurvedic Spa,Yoga,Organic Restaurant,Cooking Classes,Bird Watching"
            }
          ];
          
          // Insert hotels
          hotels.forEach(hotel => {
            db.query(
              "INSERT INTO Hotel (HotelName, HotelLocation, PricePerNight, Ratings, HotelImage, Description, Amenities) VALUES (?, ?, ?, ?, ?, ?, ?)",
              [hotel.HotelName, hotel.HotelLocation, hotel.PricePerNight, hotel.Ratings, hotel.HotelImage, hotel.Description, hotel.Amenities],
              (err) => {
                if (err) {
                  console.error("Error inserting hotel:", err);
                }
              }
            );
          });
          
          console.log("Sample hotels added to database");
        }
      });
    }
  });

  // Package_Hotel table (for relationship)
  db.query(`
    CREATE TABLE IF NOT EXISTS Package_Hotel (
      PackageId INT,
      Hotel_id INT,
      PRIMARY KEY (PackageId, Hotel_id),
      FOREIGN KEY (PackageId) REFERENCES Packages(PackageId),
      FOREIGN KEY (Hotel_id) REFERENCES Hotel(Hotel_id)
    )
  `, (err) => {
    if (err) {
      console.error("Error checking Package_Hotel table:", err);
    } else {
      console.log("Package_Hotel table checked/created");
    }
  });

  // Check for missing columns in Packages table
  const alterPackagesTable = [
    "ALTER TABLE Packages ADD COLUMN IF NOT EXISTS Duration INT DEFAULT 7",
    "ALTER TABLE Packages ADD COLUMN IF NOT EXISTS Accommodation VARCHAR(100) DEFAULT '4-5 Star'",
    "ALTER TABLE Packages ADD COLUMN IF NOT EXISTS Features TEXT",
    "ALTER TABLE Packages ADD COLUMN IF NOT EXISTS Categories VARCHAR(255)"
  ];

  alterPackagesTable.forEach(query => {
    db.query(query, (err) => {
      if (err) {
        if (err.code === 'ER_PARSE_ERROR') {
          // MySQL version might not support IF NOT EXISTS in ALTER TABLE
          console.log("Note: Your MySQL version might not support column existence check");
        } else {
          console.error(`Error executing: ${query}`, err);
        }
      }
    });
  });

  // Update existing packages with default values for new columns
  db.query(`
    UPDATE Packages 
    SET Duration = 7, 
        Accommodation = '4-5 Star', 
        Features = 'All-Inclusive,Airport Transfers',
        Categories = CASE 
          WHEN PackageLocation = 'Maldives' THEN 'beaches,luxury'
          WHEN PackageLocation = 'Switzerland' THEN 'mountains,adventure'
          ELSE 'cultural,family'
        END
    WHERE Duration IS NULL OR Accommodation IS NULL OR Features IS NULL OR Categories IS NULL
  `, (err) => {
    if (err) {
      console.error("Error updating packages with default values:", err);
    } else {
      console.log("Updated packages with default values for new columns");
    }
  });

  // Update Packages table to add missing columns
  db.query("SHOW COLUMNS FROM Packages", (err, columns) => {
    if (err) {
      console.error("Error checking Packages columns:", err);
    return;
  }

    const existingColumns = columns.map(col => col.Field);
    console.log("Existing columns in Packages table:", existingColumns);

    // First, add missing columns
    const columnsToAdd = [];
    if (!existingColumns.includes('Duration')) {
      columnsToAdd.push("ALTER TABLE Packages ADD COLUMN Duration INT DEFAULT 7");
    }
    if (!existingColumns.includes('Accommodation')) {
      columnsToAdd.push("ALTER TABLE Packages ADD COLUMN Accommodation VARCHAR(100) DEFAULT '4-5 Star'");
    }
    if (!existingColumns.includes('Features')) {
      columnsToAdd.push("ALTER TABLE Packages ADD COLUMN Features TEXT");
    }
    if (!existingColumns.includes('Categories')) {
      columnsToAdd.push("ALTER TABLE Packages ADD COLUMN Categories VARCHAR(255)");
    }

    // Execute each ALTER TABLE statement
    if (columnsToAdd.length > 0) {
      columnsToAdd.forEach(query => {
        db.query(query, (err) => {
          if (err) {
            console.error(`Error executing: ${query}`, err);
          } else {
            console.log(`Successfully executed: ${query}`);
          }
        });
      });

      // Only update values after we've added the columns (with a delay)
      setTimeout(() => {
        const updateQuery = `
          UPDATE Packages 
          SET Duration = 7, 
              Accommodation = '4-5 Star', 
              Features = 'All-Inclusive,Airport Transfers',
              Categories = CASE 
                WHEN PackageLocation = 'Maldives' THEN 'beaches,luxury'
                WHEN PackageLocation = 'Switzerland' THEN 'mountains,adventure'
                ELSE 'cultural,family'
              END
        `;
        
        db.query(updateQuery, (err) => {
          if (err) {
            console.error("Error updating packages with default values:", err);
          } else {
            console.log("Updated packages with default values for new columns");
          }
        });
      }, 1000); // Wait 1 second for ALTER TABLE statements to complete
    }
  });

  // At application startup, check if AdminReply column exists, and add it if not
  connection.query("SHOW COLUMNS FROM Enquiry LIKE 'AdminReply'", (err, results) => {
    if (err) {
      console.error("Error checking Enquiry table structure:", err);
      return;
    }
    
    // If column doesn't exist, add it
    if (results.length === 0) {
      connection.query("ALTER TABLE Enquiry ADD COLUMN AdminReply TEXT", (err) => {
        if (err) {
          console.error("Error adding AdminReply column:", err);
        } else {
          console.log("AdminReply column added to Enquiry table");
        }
      });
    }
  });

  // Add this to your database initialization section or run it directly in your database
  connection.query(`
    ALTER TABLE Enquiry 
    ADD COLUMN IF NOT EXISTS AdminReply TEXT,
    ADD COLUMN IF NOT EXISTS Status ENUM('Awaiting Reply', 'Replied') DEFAULT 'Awaiting Reply'
  `, (err) => {
    if (err) {
      console.error("Error updating Enquiry table:", err);
    } else {
      console.log("Enquiry table updated with AdminReply and Status columns");
    }
  });
});

// Add this after creating the express app
app.locals.connection = connection;

// Add error handling for the database connection
connection.on('error', function(err) {
  console.error('Database error:', err);
  if (err.code === 'PROTOCOL_CONNECTION_LOST') {
    // Reconnect if the connection is lost
    connection.connect();
  } else {
    throw err;
  }
});

// Add middleware to make session data available to all routes
app.use((req, res, next) => {
  // Make session data available to templates
  res.locals.isLoggedIn = req.session.userId ? true : false;
  res.locals.userName = req.session.userName || null;
  res.locals.userEmail = req.session.userEmail || null;
  res.locals.isAdmin = req.session.isAdmin || false;
  res.locals.currentYear = new Date().getFullYear(); // Add current year for footer
  
  // Continue to next middleware
  next();
});

// Register all routes
app.use('/', pageRoutes);
app.use('/', authRoutes);
app.use('/packages', packageRoutes);
app.use('/user', userRoutes);
app.use('/hotels', hotelRoutes);
app.use('/admin', adminRoutes);

// Route for handling book-package (keeping old path for backward compatibility)
app.post("/book-package", (req, res) => {
  res.redirect(307, "/packages/book"); // 307 to maintain POST method
});

// Route for backward compatibility with /package-details/:id links
app.get("/package-details/:id", (req, res) => {
  res.redirect(`/packages/details/${req.params.id}`);
});

// Profile redirect
app.get("/profile", (req, res) => {
  res.redirect("/user/profile");
});

// 404 handler
app.use((req, res) => {
  res.status(404).render("404", {
    title: "Page Not Found",
    isLoggedIn: req.session.userId ? true : false,
    userName: req.session.userName || null,
    userEmail: req.session.userEmail || null
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
