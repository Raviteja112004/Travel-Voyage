CREATE DATABASE TravelAgencyDB;
USE TravelAgencyDB;

CREATE TABLE Admin (
    Admin_id INT PRIMARY KEY AUTO_INCREMENT,
    UserName VARCHAR(50) NOT NULL,
    Password VARCHAR(255) NOT NULL
);

-- User Table
CREATE TABLE User (
    User_id INT PRIMARY KEY AUTO_INCREMENT,
    Name VARCHAR(100) NOT NULL,
    Email VARCHAR(100) UNIQUE NOT NULL,
    Password VARCHAR(255) NOT NULL,
    MobileNumber VARCHAR(15) UNIQUE NOT NULL
);

-- Packages Table
CREATE TABLE Packages (
    PackageId INT PRIMARY KEY AUTO_INCREMENT,
    PackageName VARCHAR(100) NOT NULL,
    PackageLocation VARCHAR(100) NOT NULL,
    PackageDetails TEXT,
    PackagePrice DECIMAL(10,2),
    PackageImage VARCHAR(255)
);

-- Hotel Table
CREATE TABLE Hotel (
    Hotel_id INT PRIMARY KEY AUTO_INCREMENT,
    HotelName VARCHAR(100) NOT NULL,
    HotelLocation VARCHAR(100) NOT NULL,
    PricePerNight DECIMAL(10,2),
    Ratings FLOAT,
    -- HotelImage VARCHAR(255),
    -- Description TEXT,
    -- Amenities TEXT
);

-- Booking Table
CREATE TABLE Booking (
    BookingID INT PRIMARY KEY AUTO_INCREMENT,
    PackageID INT,
    UserEmail VARCHAR(100),
    FromDate DATE,
    ToDate DATE,
    NumberOfPeople INT,
    Status ENUM('Pending', 'Confirmed', 'Cancelled'),
    FOREIGN KEY (PackageID) REFERENCES Packages(PackageId),
    FOREIGN KEY (UserEmail) REFERENCES User(Email)
);

-- Enquiry Table
CREATE TABLE Enquiry (
    EnquiryID INT PRIMARY KEY AUTO_INCREMENT,
    User_id INT,
    Subject VARCHAR(200),
    Email VARCHAR(100),
    Description TEXT,
    FOREIGN KEY (User_id) REFERENCES User(User_id)
);

-- Relationship: Package includes Hotel
CREATE TABLE Package_Hotel (
    PackageId INT,
    Hotel_id INT,
    PRIMARY KEY (PackageId, Hotel_id),
    FOREIGN KEY (PackageId) REFERENCES Packages(PackageId),
    FOREIGN KEY (Hotel_id) REFERENCES Hotel(Hotel_id)
);

-- Insert Admins
INSERT INTO Admin (UserName, Password) VALUES
('admin1', 'adminpass123'),
('admin2', 'securepass456');

-- Insert Users
INSERT INTO User (Name, Email, Password, MobileNumber) VALUES
('John Doe', 'john@example.com', 'pass123', '9876543210'),
('Alice Smith', 'alice@example.com', 'pass456', '8765432109');

-- Insert Packages
INSERT INTO Packages (PackageName, PackageLocation, PackageDetails, PackagePrice, PackageImage) VALUES
('Beach Paradise', 'Maldives', 'A relaxing trip to the Maldives with all-inclusive resorts.', 2000.00, 'maldives.jpg'),
('Mountain Adventure', 'Switzerland', 'Experience the best of the Alps.', 2500.00, 'swiss.jpg');

-- Insert Hotels
INSERT INTO Hotel (HotelName, HotelLocation, PricePerNight, Ratings, HotelImage, Description, Amenities) VALUES
('Ocean View Resort', 'Maldives', 500.00, 4.5, 'images/hotels/maldives-hotel1.jpg', 'Luxury overwater villas with direct ocean access', 'Private Pool,Spa,Restaurant,Diving,WiFi,Air Conditioning'),
('Alpine Lodge', 'Switzerland', 350.00, 4.7, 'images/hotels/swiss-hotel1.jpg', 'Traditional Swiss chalet with modern amenities and mountain views', 'Fireplace,Ski Storage,Restaurant,Spa,WiFi,Shuttle Service');

-- Link Packages to Hotels
INSERT INTO Package_Hotel (PackageId, Hotel_id) VALUES
(1, 1), (2, 2);

-- Insert Bookings
INSERT INTO Booking (PackageID, UserEmail, FromDate, ToDate, NumberOfPeople, Status) VALUES
(1, 'john@example.com', '2025-06-10', '2025-06-20', 2, 'Confirmed'),
(2, 'alice@example.com', '2025-07-05', '2025-07-15', 1, 'Pending');

-- Insert Enquiries
INSERT INTO Enquiry (User_id, Subject, Email, Description) VALUES
(1, 'Package Availability', 'john@example.com', 'Is the Maldives package available in June?'),
(2, 'Hotel Facilities', 'alice@example.com', 'What amenities are included in Alpine Lodge?');
