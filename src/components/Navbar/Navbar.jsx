import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import "./Navbar.css";

const countryToCurrency = {
  IN: "INR",
  AE: "AED",
};

const currencyToCountry = {
  INR: "IN",
  AED: "AE",
};

export default function Navbar({ currency, onCurrencyChange }) {
  const [activeLink, setActiveLink] = useState("HOME");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState(
    currencyToCountry[currency] || "IN"
  );
  const dropdownRef = useRef(null);

  const navItems = [
    { name: "HOME", id: "#home" },
    { name: "SHOP", id: "#shop" },
    { name: "CONTACT", id: "#contact" },
  ];

  const countries = {
    IN: { name: "India", flag: "https://flagcdn.com/in.svg" },
    AE: { name: "UAE", flag: "https://flagcdn.com/ae.svg" },
  };

  useEffect(() => {
    const nextCountry = currencyToCountry[currency] || "IN";
    setSelectedCountry(nextCountry);
  }, [currency]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleCountryChange = (code) => {
    setSelectedCountry(code);
    setIsDropdownOpen(false);

    if (onCurrencyChange) {
      onCurrencyChange(countryToCurrency[code]);
    }
  };

  return (
    <nav className="navbar">
      {/* 1. Logo Section */}
      <div className="navbar-logo">
        <Link to="/">
          <img src="/aada-logo.png" alt="Aada Logo" className="logo-img" />
        </Link>
      </div>

      {/* 2. Navigation Links */}
      <ul className="navbar-links">
        {navItems.map((item) => (
          <li key={item.name}>
            <a
              href={item.id}
              className={`nav-item ${activeLink === item.name ? "active" : ""}`}
              onClick={() => setActiveLink(item.name)}
            >
              {item.name}
            </a>
          </li>
        ))}
      </ul>

      {/* 3. Country Selector Dropdown */}
      <div className="navbar-actions" ref={dropdownRef}>
        <div className="country-dropdown">
          <div
            className="dropdown-selected"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          >
            <img
              src={countries[selectedCountry].flag}
              alt={countries[selectedCountry].name}
              className="flag-icon"
            />
          </div>

          {isDropdownOpen && (
            <div className="dropdown-menu">
              {Object.keys(countries).map((code) => (
                <div
                  key={code}
                  className="dropdown-item"
                  onClick={() => handleCountryChange(code)}
                >
                  <img
                    src={countries[code].flag}
                    alt={countries[code].name}
                    className="flag-icon"
                  />
                  <span>{countries[code].name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}