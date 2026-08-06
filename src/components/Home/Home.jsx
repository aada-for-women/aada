import React from 'react';
import './Home.css';
export default function Home() {
    return (
        <div className="home-container">
            <div className="home-text-section">
                <h1 className="home-title">
                    EMBRACE YOUR<br /> STORY WITH <br /> AADA{' '}
                    <img
                        src="/aada-leaf.png"
                        alt="Aada Leaf Motif"
                        className="aada-leaf-img"
                    />
                </h1>

                <a href="#shop" className="home-shop-btn">
                    SHOP THE COLLECTION
                </a>
            </div>

            <div className="home-image-section">
                <img src="/women-model.png" alt="Women Model" className="home-hero-image" />
            </div>

        </div>
    );
}