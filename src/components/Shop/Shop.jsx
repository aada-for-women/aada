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
  const [expandedSubcategories, setExpandedSubcategories] = useState({});

  const toggleExpandSubcategory = (key) => {
    setExpandedSubcategories((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

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
        {search && (
          <button
            type="button"
            className="search-clear-btn"
            onClick={() => setSearch("")}
            aria-label="Clear search"
          >
            ✕
          </button>
        )}
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
                  const subcategoryKey = `${category}-${subcategory}`;
                  const isExpanded = !!expandedSubcategories[subcategoryKey];
                  const visibleItems = isExpanded ? items : items.slice(0, 3);

                  return (
                    <div key={subcategory} className="subcategory-block">
                      <div className="subcategory-header">
                        <div className="subcategory-title-wrap">
                          <h3 className="subcategory-title">{subcategory}</h3>
                          <span className="subcategory-count-pill">
                            {items.length} {items.length === 1 ? 'Design' : 'Designs'}
                          </span>
                        </div>

                        {items.length > 3 && (
                          <div className="subcategory-quick-actions">
                            <button
                              type="button"
                              className="btn-quick-toggle"
                              onClick={() => toggleExpandSubcategory(subcategoryKey)}
                              aria-label={isExpanded ? `Collapse ${subcategory}` : `Expand all ${items.length} ${subcategory}`}
                            >
                              {isExpanded ? '▴ Show Top 3' : `▾ View All (${items.length})`}
                            </button>
                            <button
                              type="button"
                              className="btn-quick-modal"
                              onClick={() => openModal(items, subcategory)}
                              aria-label={`Open full ${subcategory} gallery modal`}
                            >
                              ⤢ Studio
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="product-grid">
                        {visibleItems.map((product, idx) => {
                          const productPrice = getProductPrice(product, currency);
                          const isNewlyRevealed = isExpanded && idx >= 3;

                          return (
                            <article
                              key={product.id}
                              className={`product-card ${isNewlyRevealed ? 'revealed-card' : ''}`}
                            >
                              <div className="product-image-wrap">
                                <img
                                  src={product.image}
                                  alt={product.name}
                                  className="product-image"
                                  loading="lazy"
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
                      </div>

                      {/* Collapse bar at bottom when expanded */}
                      {isExpanded && items.length > 3 && (
                        <div className="subcategory-collapse-bar">
                          <button
                            type="button"
                            className="btn-collapse-sub"
                            onClick={() => toggleExpandSubcategory(subcategoryKey)}
                          >
                            ▴ Collapse back to top 3 {subcategory}
                          </button>
                        </div>
                      )}
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
              <button
                type="button"
                className="modal-close"
                onClick={closeModal}
                aria-label="Close modal"
              >
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
                        loading="lazy"
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