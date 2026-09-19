import { useMemo, useState } from 'react';
import './Shop.css';
import catalog from '../../data/catalog.json';

const genderTabs = ['Women', 'Men', 'Kids'];
const categoryOrder = ['Clothing', 'Accessories'];

const formatPrice = (value, currency) => {
  const formatted = new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0,
  }).format(value);

  return currency === 'INR' ? `₹${formatted}` : `AED ${formatted}`;
};

const getProductPrice = (product, currency) => {
  return currency === 'INR' ? product.priceInr : product.priceAed;
};

export default function Shop({ currency }) {
  const [selectedGender, setSelectedGender] = useState('Women');
  const [search, setSearch] = useState('');
  const [modalItems, setModalItems] = useState(null);

  const products = useMemo(
    () => (Array.isArray(catalog?.products) ? catalog.products : []),
    []
  );

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();

    return products.filter((item) => {
      const matchesGender = item.gender === selectedGender;
      if (!matchesGender) return false;

      if (!query) return true;

      return (
        item.name?.toLowerCase().includes(query) ||
        item.subcategory?.toLowerCase().includes(query) ||
        item.category?.toLowerCase().includes(query)
      );
    });
  }, [products, selectedGender, search]);

  const grouped = useMemo(() => {
    return filteredProducts.reduce((acc, item) => {
      const category = item.category || 'Other';
      const subcategory = item.subcategory || 'General';

      if (!acc[category]) acc[category] = {};
      if (!acc[category][subcategory]) acc[category][subcategory] = [];

      acc[category][subcategory].push(item);
      return acc;
    }, {});
  }, [filteredProducts]);

  const openModal = (items, title) => setModalItems({ items, title });
  const closeModal = () => setModalItems(null);

  return (
    <section className="shop-page">
      <div className="shop-header">
        <p className="shop-eyebrow">Curated collection</p>
        <h1>Shop</h1>
      </div>

      <div className="shop-search">
        <span className="search-icon">⌕</span>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Find products..."
          aria-label="Search products"
        />
      </div>

      <div className="shop-tabs" role="tablist" aria-label="Product categories">
        {genderTabs.map((gender) => (
          <button
            key={gender}
            type="button"
            className={`shop-tab ${selectedGender === gender ? 'active' : ''}`}
            onClick={() => setSelectedGender(gender)}
            role="tab"
            aria-selected={selectedGender === gender}
          >
            {gender}
          </button>
        ))}
      </div>

      {filteredProducts.length === 0 ? (
        <div className="empty-state">No products found for {selectedGender}.</div>
      ) : (
        <div className="shop-gender-section">
          {categoryOrder.map((category) => {
            const categoryGroups = grouped[category] || {};
            if (!Object.keys(categoryGroups).length) return null;

            return (
              <div key={category} className="category-block">
                {Object.entries(categoryGroups).map(([subcategory, items]) => {
                  const visibleItems = items.slice(0, 3);

                  return (
                    <div key={subcategory} className="subcategory-block">
                      <div className="subcategory-header">
                        <h3 className="subcategory-title">{subcategory}</h3>
                      </div>

                      <div className="product-grid">
                        {visibleItems.map((product) => {
                          const productPrice = getProductPrice(product, currency);

                          return (
                            <article key={product.id} className="product-card">
                              <div className="product-image-wrap">
                                <img
                                  src={product.image}
                                  alt={product.name}
                                  className="product-image"
                                />

                                <div className="product-hover-overlay">
                                  <h6>{product.description}</h6>
                                </div>
                              </div>

                              <div className="product-info">
                                <h4>{product.name}</h4>
                                <p>{formatPrice(productPrice, currency)}</p>
                              </div>
                            </article>
                          );
                        })}

                        {items.length > 3 && (
                          <button
                            type="button"
                            className="view-more-btn overlay"
                            onClick={() => openModal(items, subcategory)}
                            aria-label={`View more ${subcategory}`}
                          >
                            <span className="view-more-text">View More</span>
                            <span className="view-more-arrow" aria-hidden="true">→</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {modalItems && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{modalItems.title}</h3>
              <button type="button" className="modal-close" onClick={closeModal}>
                ×
              </button>
            </div>

            <div className="modal-grid">
              {modalItems.items.map((product) => {
                const productPrice = getProductPrice(product, currency);

                return (
                  <article key={product.id} className="modal-card">
                    <div className="modal-image-wrap">
                      <img
                        src={product.image}
                        alt={product.name}
                        className="modal-image"
                      />
                    </div>

                    <div className="modal-info">
                      <h4>{product.name}</h4>
                      <p>{formatPrice(productPrice, currency)}</p>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}