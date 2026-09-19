import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

import Navbar from './components/Navbar/Navbar';
import AdminUI from './components/AdminUI/AdminUI';
import Home from './components/Home/Home';
import Shop from './components/Shop/Shop';
import Contact from './components/Contact/Contact';

const DEFAULT_CURRENCY = 'INR';
const SUPPORTED_CURRENCIES = ['INR', 'AED'];

const countryToCurrency = {
  IN: 'INR',
  AE: 'AED',
};

export default function App() {
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY);

  useEffect(() => {
    const cachedCurrency = sessionStorage.getItem('user_currency');

    if (cachedCurrency && SUPPORTED_CURRENCIES.includes(cachedCurrency)) {
      setCurrency(cachedCurrency);
      return;
    }

    const detectUserCurrency = async () => {
      try {
        const response = await fetch('https://ipapi.co/json/');
        const data = await response.json();

        const detectedCurrency =
          countryToCurrency[data.country_code] || DEFAULT_CURRENCY;

        sessionStorage.setItem('user_currency', detectedCurrency);
        setCurrency(detectedCurrency);
      } catch (error) {
        console.error('GeoIP detection failed, falling back to default:', error);
        setCurrency(DEFAULT_CURRENCY);
      }
    };

    detectUserCurrency();
  }, []);

  useEffect(() => {
    sessionStorage.setItem('user_currency', currency);
  }, [currency]);

  return (
    <Router>
      <Routes>
        <Route
          path="/"
          element={
            <div style={{ backgroundColor: '#F7F4EF', minHeight: '100vh' }}>
              <div style={{ position: 'sticky', top: 0, zIndex: 1000 }}>
                <Navbar currency={currency} onCurrencyChange={setCurrency} />
              </div>

              <section id="home">
                <Home />
              </section>

              <section id="shop">
                <Shop currency={currency} />
              </section>

              <section id="contact">
                <Contact />
              </section>
            </div>
          }
        />

        <Route path="/admin" element={<AdminUI />} />
      </Routes>
    </Router>
  );
}