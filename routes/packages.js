const express = require("express");
const router = express.Router();

// Packages Route with search and filter
router.get("/", function (req, res) {
    // Get search and filter params
    const search = req.query.search || '';
    const category = req.query.category || '';
    const priceMin = req.query.priceMin || 0;
    const priceMax = req.query.priceMax || 1000000; // Set a reasonable upper bound
    const connection = req.app.locals.connection;
    
    // Build the query with filters
    let query = "SELECT * FROM Packages WHERE 1=1";
    let params = [];
    
    // Add search condition if provided
    if (search) {
        query += " AND (PackageName LIKE ? OR PackageLocation LIKE ? OR PackageDetails LIKE ?)";
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    
    // Add category filter if provided
    if (category) {
        query += " AND Categories LIKE ?";
        params.push(`%${category}%`);
    }
    
    // Add price range filter
    query += " AND PackagePrice BETWEEN ? AND ?";
    params.push(priceMin, priceMax);
    
    // First get all categories for the filter dropdown
    connection.query("SELECT DISTINCT Categories FROM Packages", function(categoryErr, categoryResults) {
        if (categoryErr) {
            console.error("Error fetching categories:", categoryErr);
            return res.redirect("/?error=Error loading packages");
        }
        
        // Process categories into a clean, unique set
        const allCategories = new Set();
        categoryResults.forEach(cat => {
            if (cat.Categories) {
                const cats = cat.Categories.split(',');
                cats.forEach(c => allCategories.add(c.trim()));
            }
        });
        
        // Now execute the main packages query with all filters
        connection.query(query, params, function(error, packageResults) {
            if (error) {
                console.error("Error fetching packages:", error);
                return res.redirect("/?error=Could not fetch packages");
            }
            
            // Process each package to extract category data
            packageResults.forEach(pkg => {
                // Add categories as an array for easier rendering
                pkg.CategoriesArray = pkg.Categories 
                    ? pkg.Categories.split(',').map(c => c.trim())
                    : [];
                
                // Parse features if needed
                pkg.FeaturesArray = pkg.Features 
                    ? pkg.Features.split(',').map(f => f.trim())
                    : [];
            });
            
            // Ensure isLoggedIn is correctly set
            const isLoggedIn = req.session.userId ? true : false;
            
            // Render the packages page with all data
            res.render("packages", {
                packages: packageResults,
                title: "Tour Packages",
                categories: Array.from(allCategories),
                filters: {
                    search: search,
                    category: category,
                    priceMin: priceMin,
                    priceMax: priceMax
                },
                isLoggedIn: isLoggedIn,
                userName: req.session.userName || null,
                userEmail: req.session.userEmail || null
            });
        });
    });
});

// API Endpoint for Packages
router.get("/api", function (req, res) {
    const category = req.query.category;
    const connection = req.app.locals.connection;
    let query = "SELECT * FROM Packages";
    
    if (category) {
        query = `SELECT * FROM Packages WHERE Categories LIKE '%${category}%'`;
    }
    
    connection.query(query, function (error, results) {
        if (error) {
            console.error("Error fetching packages:", error);
            return res.status(500).json({ error: "Could not fetch packages" });
        }

        res.json(results);
    });
});

// Package Detail Route
router.get("/details/:id", (req, res) => {
  const packageId = req.params.id;
  const connection = req.app.locals.connection;
  
  // Fetch the package details from database
  connection.query("SELECT * FROM Packages WHERE PackageId = ?", [packageId], (err, results) => {
    if (err) {
      console.error("Error fetching package details:", err);
      return res.redirect("/packages?error=Package not found");
    }
    
    if (results.length === 0) {
      return res.redirect("/packages?error=Package not found");
    }
    
    // Store the package details and parse features into an array
    const packageDetails = results[0];
    packageDetails.FeaturesArray = packageDetails.Features ? packageDetails.Features.split(',').map(f => f.trim()) : [];
    
    // Extract the primary location from the package location
    const locationInfo = extractLocationInfo(packageDetails.PackageLocation);
    const primaryLocation = locationInfo.primaryLocation;
    const isMultiState = locationInfo.isMultiState;
    
    // Get hotels from database that match the primary location
    connection.query(
      "SELECT * FROM Hotel WHERE HotelLocation LIKE ? ORDER BY Ratings DESC", 
      [`%${primaryLocation}%`], 
      (err, hotels) => {
        if (err) {
          console.error("Error fetching hotels:", err);
          hotels = [];
        }
        
        // For each hotel, parse amenities
        hotels.forEach(hotel => {
          hotel.AmenitiesArray = hotel.Amenities ? hotel.Amenities.split(',').map(a => a.trim()) : [];
        });
        
        // Get tomorrow's date for min attribute of date input
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowFormatted = tomorrow.toISOString().split('T')[0];
        
        // Ensure isLoggedIn is correctly set
        const isLoggedIn = req.session.userId ? true : false;
        
        // Render the package details page with all the data
        res.render("package", {
          package: packageDetails,
          hotels: hotels,
          primaryLocation: primaryLocation,
          isMultiState: isMultiState,
          originalLocation: packageDetails.PackageLocation,
          tomorrow: tomorrowFormatted,
          isLoggedIn: isLoggedIn,
          userName: req.session.userName || null,
          userEmail: req.session.userEmail || null,
          layout: "main" // Use default main layout, no need for layouts/header
        });
      }
    );
  });
});

// Helper function to extract location information
function extractLocationInfo(packageLocation) {
  let primaryLocation = '';
  let isMultiState = false;
  
  // Determine if this is a multi-state package and extract primary location
  if (packageLocation.includes(',')) {
    // Multi-location separated by commas (e.g. "Tamil Nadu-Karnataka, India")
    const parts = packageLocation.split(',');
    
    // Check if the first part has a dash/hyphen, indicating multi-state
    if (parts[0].includes('-')) {
      isMultiState = true;
      // Use the first state/region as primary location
      primaryLocation = parts[0].split('-')[0].trim();
    } else {
      primaryLocation = parts[0].trim();
    }
  } else if (packageLocation.includes('-')) {
    // Multi-location separated by hyphens (e.g. "Delhi-Agra-Jaipur")
    isMultiState = true;
    primaryLocation = packageLocation.split('-')[0].trim();
  } else {
    // Single location
    primaryLocation = packageLocation.trim();
  }
  
  // Mapping for states with common names that might need special handling
  const stateMapping = {
    'Tamil Nadu': 'Tamil Nadu',
    'Karnataka': 'Karnataka',
    'Assam': 'Kaziranga',
    'Srinagar': 'Kashmir',
    'Gulmarg': 'Kashmir',
    'Pahalgam': 'Kashmir'
  };
  
  // Replace state name with more specific location if applicable
  if (stateMapping[primaryLocation]) {
    primaryLocation = stateMapping[primaryLocation];
  }
  
  return { primaryLocation, isMultiState };
}

// Book Package Route
router.post("/book", (req, res) => {
  if (!req.session.userId) {
    return res.redirect("/login?error=Please login to book a package");
  }
  
  const packageId = req.body.packageId;
  const travelers = req.body.travelers;
  const travelDate = req.body.travelDate;
  const hotelId = req.body.hotelId;
  const userEmail = req.session.userEmail;
  const connection = req.app.locals.connection;
  
  // Validate the input
  if (!packageId || !travelers || !travelDate || !hotelId) {
    return res.redirect(`/packages/details/${packageId}?error=Missing required fields`);
  }
  
  // Fetch package details from database to ensure correct pricing and duration
  connection.query("SELECT * FROM Packages WHERE PackageId = ?", [packageId], (err, packageResults) => {
    if (err || packageResults.length === 0) {
      console.error("Error fetching package details:", err);
      return res.redirect(`/packages/details/${packageId}?error=Invalid package`);
    }
    
    const packageDetails = packageResults[0];
    
    // Calculate fromDate and toDate based on travelDate and package duration
    const fromDate = new Date(travelDate);
    const duration = packageDetails.Duration || 7; // Use actual duration from DB
    
    // Calculate toDate by adding duration to fromDate
    const toDate = new Date(fromDate);
    toDate.setDate(toDate.getDate() + parseInt(duration));
    
    const formattedFromDate = fromDate.toISOString().split('T')[0];
    const formattedToDate = toDate.toISOString().split('T')[0];
    
    // Insert the booking with the actual data from DB
    connection.query(
      "INSERT INTO Booking (PackageID, UserEmail, FromDate, ToDate, NumberOfPeople, Status, HotelID) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [packageId, userEmail, formattedFromDate, formattedToDate, travelers, "Pending", hotelId],
      (err, result) => {
        if (err) {
          console.error("Error booking package:", err);
          return res.redirect(`/packages/details/${packageId}?error=Database error when booking: ${err.message}`);
        }
        
        return res.redirect(`/user/profile?success=Package booked successfully! Your booking is pending confirmation.`);
      }
    );
  });
});

// Add More Indian Destinations (admin or demo route)
router.get("/add-more-destinations", function(req, res) {
    const connection = req.app.locals.connection;
    // Check if admin or skip this check for demo
    const morePackages = [
        {
            PackageName: "Leh Ladakh Adventure",
            PackageLocation: "Ladakh, India",
            PackageDetails: "Experience the breathtaking landscapes, ancient monasteries, and unique culture of Ladakh in this high-altitude adventure.",
            PackagePrice: 65000.00,
            PackageImage: "https://placehold.co/800x500",
            Duration: 9,
            Accommodation: "Luxury Camps and Hotels",
            Features: "Monastery Tours,Pangong Lake Visit,Nubra Valley Excursion,Local Homestay Experience,White Water Rafting",
            Categories: "india,adventure,mountains"
        },
        {
            PackageName: "Andaman Island Escape",
            PackageLocation: "Andaman Islands, India",
            PackageDetails: "Discover crystal clear waters, pristine beaches, and vibrant coral reefs on this tropical paradise in the Bay of Bengal.",
            PackagePrice: 55000.00,
            PackageImage: "https://placehold.co/800x500",
            Duration: 6,
            Accommodation: "Beach Resorts",
            Features: "Snorkeling,Scuba Diving,Island Hopping,Glass Bottom Boat Ride,Cellular Jail Visit",
            Categories: "india,beaches,island"
        },
        {
            PackageName: "Meghalaya & Assam Explorer",
            PackageLocation: "Northeast India",
            PackageDetails: "Journey through the living root bridges of Meghalaya, tea gardens of Assam, and experience the diverse cultures of Northeast India.",
            PackagePrice: 48000.00,
            PackageImage: "https://placehold.co/800x500",
            Duration: 8,
            Accommodation: "Heritage Hotels and Homestays",
            Features: "Living Root Bridge Trek,Tea Plantation Tours,Kaziranga National Park Safari,Tribal Village Visits,River Cruise",
            Categories: "india,nature,cultural"
        },
        {
            PackageName: "Rishikesh Yoga Retreat",
            PackageLocation: "Rishikesh, India",
            PackageDetails: "Rejuvenate your mind, body, and soul with yoga, meditation, and wellness activities in the yoga capital of the world.",
            PackagePrice: 35000.00,
            PackageImage: "https://placehold.co/800x500",
            Duration: 7,
            Accommodation: "Yoga Ashrams and Wellness Resorts",
            Features: "Daily Yoga Classes,Meditation Sessions,Ayurvedic Treatments,Ganga Aarti Ceremony,White Water Rafting",
            Categories: "india,wellness,spiritual"
        },
        {
            PackageName: "Mumbai & Goa Combo",
            PackageLocation: "Mumbai-Goa, India",
            PackageDetails: "Experience the vibrant city life of Mumbai followed by relaxing beach time in Goa in this perfect combination package.",
            PackagePrice: 42000.00,
            PackageImage: "https://placehold.co/800x500",
            Duration: 8,
            Accommodation: "City Hotels and Beach Resorts",
            Features: "Mumbai City Tour,Bollywood Experience,Goa Beach Time,Water Sports,Spice Plantation Visit",
            Categories: "india,cities,beaches"
        }
    ];
    
    // Insert packages
    let insertedCount = 0;
    morePackages.forEach(pkg => {
        connection.query(
            "INSERT INTO Packages (PackageName, PackageLocation, PackageDetails, PackagePrice, PackageImage, Duration, Accommodation, Features, Categories) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [pkg.PackageName, pkg.PackageLocation, pkg.PackageDetails, pkg.PackagePrice, pkg.PackageImage, pkg.Duration, pkg.Accommodation, pkg.Features, pkg.Categories],
            (err) => {
                if (err) {
                    console.error("Error inserting package:", err);
                } else {
                    insertedCount++;
                }
                
                if (insertedCount === morePackages.length) {
                    res.send("Added " + insertedCount + " new destinations successfully!");
                }
            }
        );
    });
});

module.exports = router; 