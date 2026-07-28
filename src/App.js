import React from 'react';
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import Navbar from "./components/Navbar/Navbar";
import AdminUI from "./components/AdminUI/AdminUI";
import Home from "./components/Home/Home";
import Shop from "./components/Shop/Shop";
import About from "./components/About/About";
import Contact from "./components/Contact/Contact";

export default function App() {
    return (
        <Router>
            <Routes>
                
                {/* PUBLIC ROUTE: The Single Scrolling Page */}
                <Route 
                    path="/" 
                    element={
                        <div style={{ backgroundColor: "#F7F4EF", minHeight: "100vh" }}>
                            
                            {/* Make the Navbar sticky so it stays at the top while scrolling */}
                            <div style={{ position: "sticky", top: 0, zIndex: 1000 }}>
                                <Navbar />
                            </div>
                            
                            {/* Stack the sections and give them IDs that match your Navbar anchor links */}
                            <section id="home">
                                <Home />
                            </section>

                            <section id="shop">
                                <Shop />
                            </section>

                            <section id="about">
                                <About />
                            </section>

                            <section id="contact">
                                <Contact />
                            </section>
                            
                        </div>
                    } 
                />

                {/* ADMIN ROUTE: Completely separate and hidden */}
                <Route path="/admin" element={<AdminUI />} />
                
            </Routes>
        </Router>
    );
}