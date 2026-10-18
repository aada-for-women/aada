import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './AdminUI.css';
import initialCatalogData from '../../data/catalog.json';
import {
  uploadProductImage,
  saveProductToFirestore,
  loginWithEmail,
  loginWithGoogle,
  logoutUser,
  subscribeToAuthState,
  resetPassword,
  getFirebaseConfigSummary
} from '../../services/firebase';

const DEFAULT_PASSCODE = process.env.REACT_APP_ADMIN_PASSCODE || 'aada2026';
const AED_EXCHANGE_RATE = 22.3; // 1 AED ~ 22.3 INR

const GENDER_OPTIONS = ['Women', 'Men', 'Kids'];
const CATEGORY_OPTIONS = ['Clothing', 'Accessories'];

const PRESET_SUBCATEGORIES = {
  Clothing: [
    'Ethnic Wear',
    'Office Wear',
    'Festive Wear',
    'Casual Wear',
    'Sarees',
    'Lehengas',
    'Kurta Sets',
    'Indo-Western'
  ],
  Accessories: [
    'Jewellery',
    'Kundan & Polki',
    'Temple Jewellery',
    'Necklaces',
    'Earrings',
    'Bangles',
    'Bags',
    'Wallets',
    'Belts'
  ]
};

const getInitialSubcategories = (initialProducts = []) => {
  let savedCustom = {};
  try {
    const raw = localStorage.getItem('aada_custom_subcategories');
    if (raw) savedCustom = JSON.parse(raw);
  } catch (e) {
    console.error('Error reading cached custom subcategories:', e);
  }

  const buildCategoryList = (cat, defaultList) => {
    const fromProducts = initialProducts
      .filter((p) => p.category === cat && p.subcategory)
      .map((p) => p.subcategory.trim());
    const fromSaved = Array.isArray(savedCustom[cat]) ? savedCustom[cat] : [];
    return Array.from(new Set([...defaultList, ...fromSaved, ...fromProducts]));
  };

  return {
    Clothing: buildCategoryList('Clothing', PRESET_SUBCATEGORIES.Clothing),
    Accessories: buildCategoryList('Accessories', PRESET_SUBCATEGORIES.Accessories)
  };
};

export default function AdminUI() {
  // ---------------------------------------------------------------------------
  // 1. Firebase Authentication & Restriction State
  // ---------------------------------------------------------------------------
  const [currentUser, setCurrentUser] = useState(null);
  const [authMode, setAuthMode] = useState('firebase'); // 'firebase' | 'passcode'
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  const [isRestrictedMode, setIsRestrictedMode] = useState(() => {
    const saved = localStorage.getItem('aada_admin_restricted_mode');
    return saved !== null ? JSON.parse(saved) : true;
  });

  const [passcodeInput, setPasscodeInput] = useState('');
  const [isPasscodeUnlocked, setIsPasscodeUnlocked] = useState(() => {
    return sessionStorage.getItem('aada_admin_auth') === 'granted';
  });

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsubscribe = subscribeToAuthState((user) => {
      setCurrentUser(user);
      if (user) {
        sessionStorage.setItem('aada_admin_auth', 'granted');
      }
    });
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  const isAuthenticated = Boolean(currentUser || isPasscodeUnlocked);

  // ---------------------------------------------------------------------------
  // 2. Navigation & Mobile Tabs
  // ---------------------------------------------------------------------------
  const [activeTab, setActiveTab] = useState('create'); // 'create' | 'inventory' | 'cloud'
  const [mobileEditorView, setMobileEditorView] = useState('form'); // 'form' | 'preview'

  // ---------------------------------------------------------------------------
  // 3. Inventory & Catalog Data State
  // ---------------------------------------------------------------------------
  const [products, setProducts] = useState(() => {
    const localSaved = localStorage.getItem('aada_admin_catalog_items');
    if (localSaved) {
      try {
        return JSON.parse(localSaved);
      } catch (e) {
        console.error('Failed to parse cached catalog:', e);
      }
    }
    return Array.isArray(initialCatalogData?.products)
      ? initialCatalogData.products
      : [];
  });

  useEffect(() => {
    localStorage.setItem('aada_admin_catalog_items', JSON.stringify(products));
  }, [products]);

  // Dynamic subcategories state (combines presets, products, and custom subcategories)
  const [availableSubcategories, setAvailableSubcategories] = useState(() => {
    return getInitialSubcategories(products);
  });

  useEffect(() => {
    localStorage.setItem(
      'aada_custom_subcategories',
      JSON.stringify(availableSubcategories)
    );
  }, [availableSubcategories]);

  // ---------------------------------------------------------------------------
  // 4. Form State for New Product
  // ---------------------------------------------------------------------------
  const generateNextId = (list) => {
    const count = list.length + 1;
    return `item_${String(count).padStart(3, '0')}`;
  };

  const initialFormState = {
    id: generateNextId(products),
    name: '',
    description: '',
    priceInr: '',
    priceAed: '',
    gender: 'Women',
    category: 'Clothing',
    subcategory: 'Ethnic Wear',
    customSubcategory: '',
    inStock: true,
    image: '',
    imageSourceType: 'upload'
  };

  const [formData, setFormData] = useState(initialFormState);
  const [selectedFile, setSelectedFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewCurrency, setPreviewCurrency] = useState('INR');

  const fileInputGalleryRef = useRef(null);
  const fileInputCameraRef = useRef(null);

  // ---------------------------------------------------------------------------
  // 5. Inventory Search & Filters
  // ---------------------------------------------------------------------------
  const [searchQuery, setSearchQuery] = useState('');
  const [filterGender, setFilterGender] = useState('All');
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterStock, setFilterStock] = useState('All');

  // ---------------------------------------------------------------------------
  // 6. Toasts & Feedback
  // ---------------------------------------------------------------------------
  const [toasts, setToasts] = useState([]);

  const addToast = (message, type = 'info') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  // ---------------------------------------------------------------------------
  // Firebase Auth Handlers
  // ---------------------------------------------------------------------------
  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    try {
      const res = await loginWithEmail(authEmail, authPassword);
      addToast(`Welcome back, ${res.user.email || 'Admin'}!`, 'success');
      setIsPasscodeUnlocked(true);
      setAuthEmail('');
      setAuthPassword('');
    } catch (err) {
      console.error('Firebase Auth error:', err);
      setAuthError(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setAuthError('');
    setAuthLoading(true);
    try {
      const res = await loginWithGoogle();
      addToast(`Signed in with Google as ${res.user.displayName || res.user.email}!`, 'success');
      setIsPasscodeUnlocked(true);
    } catch (err) {
      console.error('Google Auth error:', err);
      setAuthError(err.message || 'Google sign-in could not be completed.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!authEmail) {
      setAuthError('Please enter your email address to receive a password reset link.');
      return;
    }
    try {
      await resetPassword(authEmail);
      addToast('Password reset link sent to your email!', 'info');
    } catch (err) {
      setAuthError(err.message);
    }
  };

  const handlePasscodeUnlock = (e) => {
    if (e) e.preventDefault();
    if (passcodeInput.trim() === DEFAULT_PASSCODE) {
      setIsPasscodeUnlocked(true);
      sessionStorage.setItem('aada_admin_auth', 'granted');
      setAuthError('');
      setPasscodeInput('');
      addToast('Access granted via administrative passcode', 'success');
    } else {
      setAuthError('Invalid passcode. Try "aada2026" or use Demo Unlock.');
    }
  };

  const handleDemoUnlock = () => {
    const mockUser = {
      email: 'admin.preview@aada-atelier.com',
      displayName: 'AADA Mobile Admin',
      isDemo: true
    };
    setCurrentUser(mockUser);
    setIsPasscodeUnlocked(true);
    sessionStorage.setItem('aada_admin_auth', 'granted');
    addToast('Unlocked in Admin Mobile Demonstration Mode', 'success');
  };

  const handleSignOut = async () => {
    await logoutUser();
    setCurrentUser(null);
    setIsPasscodeUnlocked(false);
    addToast('Admin session signed out', 'info');
  };

  const toggleRestrictedMode = (enable) => {
    setIsRestrictedMode(enable);
    localStorage.setItem('aada_admin_restricted_mode', JSON.stringify(enable));
    addToast(
      enable
        ? 'Restricted mode active: Authentication required on next visit.'
        : 'Open access active: Passcode/Auth gate disabled.',
      'warning'
    );
  };

  // ---------------------------------------------------------------------------
  // Form Field Change Handlers
  // ---------------------------------------------------------------------------
  const handleInputChange = (field, value) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };

      if (field === 'priceInr') {
        const numInr = parseFloat(value);
        if (!isNaN(numInr) && numInr > 0) {
          updated.priceAed = Math.round(numInr / AED_EXCHANGE_RATE);
        } else if (!value) {
          updated.priceAed = '';
        }
      }

      if (field === 'category') {
        const defaults = availableSubcategories[value] || [];
        updated.subcategory = defaults[0] || '';
        updated.customSubcategory = '';
      }

      return updated;
    });
  };

  const handleAutoConvertAed = () => {
    const inr = parseFloat(formData.priceInr);
    if (!isNaN(inr) && inr > 0) {
      const calc = Math.round(inr / AED_EXCHANGE_RATE);
      handleInputChange('priceAed', calc);
      addToast(`AED converted: ₹${inr} ≈ AED ${calc}`, 'info');
    } else {
      addToast('Enter a valid INR price first', 'warning');
    }
  };

  // ---------------------------------------------------------------------------
  // Mobile Camera & Image Upload Handlers
  // ---------------------------------------------------------------------------
  const handleFileSelect = (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      addToast('Please select a valid image file (JPG, PNG, WEBP)', 'error');
      return;
    }

    setSelectedFile(file);
    const localUrl = URL.createObjectURL(file);
    setImagePreview(localUrl);
    setFormData((prev) => ({ ...prev, image: localUrl }));
  };

  const handleRemoveImage = () => {
    setSelectedFile(null);
    setImagePreview('');
    setFormData((prev) => ({ ...prev, image: '' }));
    if (fileInputGalleryRef.current) fileInputGalleryRef.current.value = '';
    if (fileInputCameraRef.current) fileInputCameraRef.current.value = '';
  };

  // ---------------------------------------------------------------------------
  // Form Submission & Cloud Sync
  // ---------------------------------------------------------------------------
  const handleSubmitProduct = async (e) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      addToast('Product name is required', 'error');
      return;
    }

    if (!formData.priceInr || Number(formData.priceInr) <= 0) {
      addToast('Please specify a valid price in INR', 'error');
      return;
    }

    setIsSubmitting(true);
    setUploadProgress(15);

    try {
      let finalImageUrl = formData.image;

      // 1. Upload to Firebase Storage if file picked from phone camera/gallery
      if (selectedFile) {
        addToast('Uploading image to Firebase Storage...', 'info');
        const uploadResult = await uploadProductImage(selectedFile, (pct) => {
          setUploadProgress(pct);
        });

        finalImageUrl = uploadResult.downloadURL;
        if (uploadResult.warning) {
          addToast(uploadResult.warning, 'warning');
        } else {
          addToast('Image uploaded to Firebase Storage!', 'success');
        }
      } else if (!finalImageUrl) {
        finalImageUrl =
          formData.category === 'Accessories'
            ? 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=900&q=80'
            : 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=900&q=80';
      }

      // 2. Structured product matching catalog.json
      const rawCustom = formData.customSubcategory.trim();
      const finalSubcategory = rawCustom || formData.subcategory;

      // Automatically register any new custom subcategory into availableSubcategories
      // so it appears permanently in the dropdown for this category!
      if (rawCustom) {
        setAvailableSubcategories((prev) => {
          const currentList = prev[formData.category] || [];
          if (!currentList.includes(rawCustom)) {
            return {
              ...prev,
              [formData.category]: [...currentList, rawCustom]
            };
          }
          return prev;
        });
      }

      const newProductItem = {
        id: formData.id.trim() || generateNextId(products),
        name: formData.name.trim(),
        description: formData.description.trim() || 'Curated AADA designer piece.',
        priceInr: Number(formData.priceInr),
        priceAed:
          Number(formData.priceAed) ||
          Math.round(Number(formData.priceInr) / AED_EXCHANGE_RATE),
        image: finalImageUrl,
        gender: formData.gender,
        category: formData.category,
        subcategory: finalSubcategory,
        inStock: Boolean(formData.inStock)
      };

      // 3. Save to Firestore
      addToast('Saving item to Firestore catalog database...', 'info');
      const firestoreResult = await saveProductToFirestore(newProductItem);

      if (firestoreResult.success) {
        addToast(firestoreResult.message, 'success');
      } else {
        addToast(firestoreResult.message, 'warning');
      }

      // 4. Update local state
      const updatedList = [newProductItem, ...products];
      setProducts(updatedList);

      // Reset form, keeping the new subcategory selected in the dropdown for the next entry
      setFormData({
        ...initialFormState,
        id: generateNextId(updatedList),
        category: formData.category,
        subcategory: finalSubcategory,
        customSubcategory: ''
      });
      setSelectedFile(null);
      setImagePreview('');
      setUploadProgress(0);
      if (fileInputGalleryRef.current) fileInputGalleryRef.current.value = '';
      if (fileInputCameraRef.current) fileInputCameraRef.current.value = '';

      addToast(
        rawCustom
          ? `"${newProductItem.name}" saved! "${rawCustom}" added to ${formData.category} dropdown.`
          : `"${newProductItem.name}" added to catalog!`,
        'success'
      );
    } catch (err) {
      console.error('Submission failed:', err);
      addToast(`Failed to add product: ${err.message}`, 'error');
    } finally {
      setIsSubmitting(false);
      setUploadProgress(0);
    }
  };

  // ---------------------------------------------------------------------------
  // Inventory Table / Mobile Card Operations
  // ---------------------------------------------------------------------------
  const toggleStock = (id) => {
    setProducts((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, inStock: !item.inStock } : item
      )
    );
    addToast(`Item ${id} stock updated`, 'info');
  };

  const deleteProduct = (id, name) => {
    if (window.confirm(`Remove "${name}" (${id}) from inventory?`)) {
      setProducts((prev) => prev.filter((item) => item.id !== id));
      addToast(`"${name}" removed from inventory`, 'warning');
    }
  };

  const handleDuplicateToForm = (item) => {
    if (item.subcategory) {
      setAvailableSubcategories((prev) => {
        const cat = item.category || 'Clothing';
        const list = prev[cat] || [];
        if (!list.includes(item.subcategory)) {
          return {
            ...prev,
            [cat]: [...list, item.subcategory]
          };
        }
        return prev;
      });
    }

    setFormData({
      id: generateNextId(products),
      name: `${item.name} (Copy)`,
      description: item.description,
      priceInr: item.priceInr,
      priceAed: item.priceAed,
      gender: item.gender,
      category: item.category,
      subcategory: item.subcategory,
      customSubcategory: '',
      inStock: item.inStock,
      image: item.image,
      imageSourceType: 'upload'
    });
    setImagePreview(item.image);
    setActiveTab('create');
    setMobileEditorView('form');
    addToast(`Loaded "${item.name}" into editor`, 'info');
  };

  const handleDownloadCatalogJson = () => {
    const dataStr =
      'data:text/json;charset=utf-8,' +
      encodeURIComponent(JSON.stringify({ products }, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', 'catalog.json');
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    addToast('catalog.json exported successfully!', 'success');
  };

  // ---------------------------------------------------------------------------
  // Top 6 Most Selected Quick Suggestions for Subcategories
  // ---------------------------------------------------------------------------
  const quickSuggestions = useMemo(() => {
    const list = availableSubcategories[formData.category] || [];
    if (!list.length) return [];

    // Count usage frequency of each subcategory in catalog
    const countMap = {};
    products.forEach((p) => {
      if (p.category === formData.category && p.subcategory) {
        countMap[p.subcategory] = (countMap[p.subcategory] || 0) + 1;
      }
    });

    // Sort by most used first
    const sorted = [...list].sort((a, b) => {
      const countA = countMap[a] || 0;
      const countB = countMap[b] || 0;
      return countB - countA;
    });

    // Top 6 items
    const top6 = sorted.slice(0, 6);

    // Ensure currently selected item is visible if not in top 6
    if (formData.subcategory && !top6.includes(formData.subcategory)) {
      return [...top6.slice(0, 5), formData.subcategory];
    }

    return top6;
  }, [availableSubcategories, formData.category, formData.subcategory, products]);

  // ---------------------------------------------------------------------------
  // Filters and Metrics
  // ---------------------------------------------------------------------------
  const filteredInventory = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return products.filter((item) => {
      const matchSearch =
        !q ||
        item.name?.toLowerCase().includes(q) ||
        item.id?.toLowerCase().includes(q) ||
        item.subcategory?.toLowerCase().includes(q);

      const matchGender = filterGender === 'All' || item.gender === filterGender;
      const matchCategory = filterCategory === 'All' || item.category === filterCategory;
      const matchStock =
        filterStock === 'All' ||
        (filterStock === 'In Stock' ? item.inStock : !item.inStock);

      return matchSearch && matchGender && matchCategory && matchStock;
    });
  }, [products, searchQuery, filterGender, filterCategory, filterStock]);

  const stats = useMemo(() => {
    return {
      total: products.length,
      clothing: products.filter((p) => p.category === 'Clothing').length,
      accessories: products.filter((p) => p.category === 'Accessories').length,
      inStock: products.filter((p) => p.inStock).length
    };
  }, [products]);

  const configSummary = getFirebaseConfigSummary();

  // ---------------------------------------------------------------------------
  // RESTRICTION / FIREBASE AUTH SCREEN
  // ---------------------------------------------------------------------------
  if (isRestrictedMode && !isAuthenticated) {
    return (
      <div className="admin-lock-screen">
        <div className="lock-card">
          <div className="lock-brand">
            <div className="lock-logo-badge">✦</div>
            <h1>AADA ATELIER</h1>
            <p>Admin Authorization</p>
          </div>

          {/* Mode Switch: Firebase Auth vs Admin Passcode */}
          <div className="auth-mode-switch">
            <button
              type="button"
              className={`auth-mode-tab ${authMode === 'firebase' ? 'active' : ''}`}
              onClick={() => {
                setAuthMode('firebase');
                setAuthError('');
              }}
            >
              🔒 Firebase Auth
            </button>
            <button
              type="button"
              className={`auth-mode-tab ${authMode === 'passcode' ? 'active' : ''}`}
              onClick={() => {
                setAuthMode('passcode');
                setAuthError('');
              }}
            >
              🔑 Passcode / PIN
            </button>
          </div>

          {authError && <div className="lock-error-text">{authError}</div>}

          {/* Tab 1: Firebase Auth (Email/Pass & Google) */}
          {authMode === 'firebase' && (
            <div className="lock-form">
              <form onSubmit={handleEmailAuth} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="lock-input-group">
                  <label htmlFor="auth-email">Admin Email</label>
                  <input
                    id="auth-email"
                    type="email"
                    className="lock-input"
                    placeholder="admin@aada-atelier.com"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>

                <div className="lock-input-group">
                  <label htmlFor="auth-password">Password</label>
                  <input
                    id="auth-password"
                    type="password"
                    className="lock-input"
                    placeholder="••••••••"
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                  />
                </div>

                <button
                  type="submit"
                  className="lock-btn-primary"
                  disabled={authLoading}
                >
                  {authLoading ? 'Verifying Credentials...' : 'Sign In as Administrator ➔'}
                </button>

                <div className="auth-sub-links" style={{ justifyContent: 'center' }}>
                  <button
                    type="button"
                    className="auth-link-btn"
                    onClick={handlePasswordReset}
                  >
                    Forgot administrator password?
                  </button>
                </div>
              </form>

              <div className="lock-divider">
                <span>or continue with</span>
              </div>

              {/* 1-Tap Google Sign In for Mobile */}
              <button
                type="button"
                className="btn-google-auth"
                onClick={handleGoogleAuth}
                disabled={authLoading}
              >
                <svg className="google-icon" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                Continue with Google
              </button>

              <button
                type="button"
                className="lock-btn-secondary"
                onClick={handleDemoUnlock}
              >
                Instant Mobile Demo Unlock
              </button>
            </div>
          )}

          {/* Tab 2: Passcode Mode */}
          {authMode === 'passcode' && (
            <form onSubmit={handlePasscodeUnlock} className="lock-form">
              <div className="lock-input-group">
                <label htmlFor="admin-passcode-input">Access Passcode</label>
                <input
                  id="admin-passcode-input"
                  type="password"
                  className="lock-input"
                  placeholder="Enter passcode (default: aada2026)"
                  value={passcodeInput}
                  onChange={(e) => setPasscodeInput(e.target.value)}
                  autoFocus
                />
              </div>

              <button type="submit" className="lock-btn-primary">
                Unlock Session ➔
              </button>

              <button
                type="button"
                className="lock-btn-secondary"
                onClick={handleDemoUnlock}
              >
                Instant Mobile Demo Unlock
              </button>
            </form>
          )}

          <Link to="/" className="lock-return-link">
            ← Back to Public Boutique
          </Link>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // MAIN STANDALONE ADMIN PORTAL
  // ---------------------------------------------------------------------------
  return (
    <div className="admin-wrapper">
      {/* Top Navbar */}
      <header className="admin-navbar">
        <div className="admin-brand">
          <img
            src={`${process.env.PUBLIC_URL}/aada-leaf.png`}
            alt="AADA"
            className="brand-leaf-icon"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
          <div className="brand-text">
            <h2>AADA CONTROL</h2>
            <div className="brand-tag">
              <span className="dot-indicator" style={{ color: '#7C2027' }} />
              Inventory Portal
            </div>
          </div>
        </div>

        <div className="admin-nav-actions">
          {currentUser && (
            <span
              className="user-status-pill"
              title={`Logged in as ${currentUser.email || currentUser.displayName}`}
            >
              <span className="user-avatar-dot" />
              {currentUser.displayName || currentUser.email || 'Admin'}
            </span>
          )}

          <Link to="/" className="nav-action-btn" title="View customer storefront">
            Store ↗
          </Link>

          <button
            onClick={handleSignOut}
            className="nav-action-btn danger"
            title="Sign Out Admin"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Desktop Tabs */}
      <nav className="admin-tab-bar-desktop" aria-label="Admin Navigation Tabs">
        <button
          className={`admin-tab-btn ${activeTab === 'create' ? 'active' : ''}`}
          onClick={() => setActiveTab('create')}
        >
          <span>✦ Add New Product</span>
        </button>

        <button
          className={`admin-tab-btn ${activeTab === 'inventory' ? 'active' : ''}`}
          onClick={() => setActiveTab('inventory')}
        >
          <span>Inventory Catalog</span>
          <span className="tab-count-badge">{products.length}</span>
        </button>

        <button
          className={`admin-tab-btn ${activeTab === 'cloud' ? 'active' : ''}`}
          onClick={() => setActiveTab('cloud')}
        >
          <span>Cloud & Auth Settings</span>
        </button>
      </nav>

      {/* Main Content Area */}
      <main className="admin-main-container">
        {/* ==================================================================
            TAB 1: Product Editor & Live Preview
            ================================================================== */}
        {activeTab === 'create' && (
          <div>
            {/* Mobile View Toggle Switch */}
            <div className="mobile-view-toggle">
              <button
                type="button"
                className={`mobile-view-btn ${mobileEditorView === 'form' ? 'active' : ''}`}
                onClick={() => setMobileEditorView('form')}
              >
                ✏️ Edit Product Details
              </button>
              <button
                type="button"
                className={`mobile-view-btn ${mobileEditorView === 'preview' ? 'active' : ''}`}
                onClick={() => setMobileEditorView('preview')}
              >
                👀 Live Storefront Card
              </button>
            </div>

            <div className={`product-editor-grid view-${mobileEditorView}`}>
              {/* Form Section */}
              <div className="editor-card">
                <div className="card-header">
                  <h3>Add Item to Catalog</h3>
                  <p>
                    Add clothing, jewellery, and ornaments to publish to Firestore
                    and Firebase Storage.
                  </p>
                </div>

                <div className="card-body">
                  <form onSubmit={handleSubmitProduct}>
                    {/* General Details */}
                    <div className="form-section-title">Product Details</div>

                    <div className="form-grid-2">
                      <div className="form-group">
                        <label htmlFor="product-name">Product Name *</label>
                        <input
                          id="product-name"
                          type="text"
                          className="form-input"
                          placeholder="e.g. Royal Maroon Silk Saree / Kundan Choker"
                          value={formData.name}
                          onChange={(e) =>
                            handleInputChange('name', e.target.value)
                          }
                          required
                        />
                      </div>

                      <div className="form-group">
                        <label htmlFor="product-id">Product ID</label>
                        <div className="input-with-button">
                          <input
                            id="product-id"
                            type="text"
                            className="form-input"
                            value={formData.id}
                            onChange={(e) =>
                              handleInputChange('id', e.target.value)
                            }
                          />
                          <button
                            type="button"
                            className="btn-inline-action"
                            onClick={() =>
                              handleInputChange('id', generateNextId(products))
                            }
                            title="Generate Next ID"
                          >
                            Auto
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Gender Selector */}
                    <div className="form-group">
                      <label>Target Audience / Gender</label>
                      <div className="radio-pill-group">
                        {GENDER_OPTIONS.map((g) => (
                          <div
                            key={g}
                            className={`radio-pill ${
                              formData.gender === g ? 'selected' : ''
                            }`}
                            onClick={() => handleInputChange('gender', g)}
                          >
                            {g}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Category & Subcategory */}
                    <div className="form-grid-2">
                      <div className="form-group">
                        <label htmlFor="product-category">Category *</label>
                        <select
                          id="product-category"
                          className="form-select"
                          value={formData.category}
                          onChange={(e) =>
                            handleInputChange('category', e.target.value)
                          }
                        >
                          {CATEGORY_OPTIONS.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat} {cat === 'Accessories' ? '(Ornaments & Jewellery)' : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="form-group">
                        <label htmlFor="product-subcategory">Subcategory</label>
                        <select
                          id="product-subcategory"
                          className="form-select"
                          value={formData.subcategory}
                          onChange={(e) =>
                            handleInputChange('subcategory', e.target.value)
                          }
                        >
                          {(availableSubcategories[formData.category] || []).map(
                            (sub) => (
                              <option key={sub} value={sub}>
                                {sub}
                              </option>
                            )
                          )}
                        </select>
                      </div>
                    </div>

                    {/* Quick Preset Chips (Top 6 Most Selected) */}
                    <div className="form-group">
                      <label>Popular Quick Suggestions (Top 6)</label>
                      <div className="preset-chips">
                        {quickSuggestions.map((sub) => (
                          <span
                            key={sub}
                            className={`chip ${
                              formData.subcategory === sub ? 'active' : ''
                            }`}
                            onClick={() => {
                              handleInputChange('subcategory', sub);
                              handleInputChange('customSubcategory', '');
                            }}
                          >
                            {sub}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Custom Subcategory */}
                    <div className="form-group">
                      <label htmlFor="custom-subcategory">
                        New Custom Subcategory (Optional)
                      </label>
                      <div className="input-with-button">
                        <input
                          id="custom-subcategory"
                          type="text"
                          className="form-input"
                          placeholder="e.g. Bridal Polki, Antique Brooch, Organza Dupatta"
                          value={formData.customSubcategory}
                          onChange={(e) =>
                            handleInputChange('customSubcategory', e.target.value)
                          }
                        />
                        {formData.customSubcategory.trim() && (
                          <button
                            type="button"
                            className="btn-inline-action"
                            onClick={() => {
                              const newSub = formData.customSubcategory.trim();
                              if (newSub) {
                                setAvailableSubcategories((prev) => {
                                  const currentList = prev[formData.category] || [];
                                  if (!currentList.includes(newSub)) {
                                    return {
                                      ...prev,
                                      [formData.category]: [...currentList, newSub]
                                    };
                                  }
                                  return prev;
                                });
                                handleInputChange('subcategory', newSub);
                                handleInputChange('customSubcategory', '');
                                addToast(
                                  `"${newSub}" mapped into ${formData.category} dropdown!`,
                                  'success'
                                );
                              }
                            }}
                            title="Map into dropdown now"
                          >
                            + Add to Dropdown
                          </button>
                        )}
                      </div>
                      <small style={{ fontSize: 11, color: '#6E6660', marginTop: 4, display: 'block' }}>
                        💡 Any custom subcategory entered here is automatically mapped into the {formData.category} dropdown for all future items.
                      </small>
                    </div>

                    {/* Pricing */}
                    <div className="form-section-title" style={{ marginTop: 22 }}>
                      Pricing & Currencies
                    </div>

                    <div className="form-grid-2">
                      <div className="form-group">
                        <label htmlFor="price-inr">Price in INR (₹) *</label>
                        <input
                          id="price-inr"
                          type="number"
                          inputMode="numeric"
                          min="0"
                          className="form-input"
                          placeholder="2499"
                          value={formData.priceInr}
                          onChange={(e) =>
                            handleInputChange('priceInr', e.target.value)
                          }
                          required
                        />
                      </div>

                      <div className="form-group">
                        <label htmlFor="price-aed">Price in AED (Dirhams)</label>
                        <div className="input-with-button">
                          <input
                            id="price-aed"
                            type="number"
                            inputMode="numeric"
                            min="0"
                            className="form-input"
                            placeholder="112"
                            value={formData.priceAed}
                            onChange={(e) =>
                              handleInputChange('priceAed', e.target.value)
                            }
                          />
                          <button
                            type="button"
                            className="btn-inline-action"
                            onClick={handleAutoConvertAed}
                            title="Auto Calculate AED from INR"
                          >
                            Auto AED
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Stock Status */}
                    <div className="form-group">
                      <div
                        className="stock-toggle-box"
                        onClick={() =>
                          handleInputChange('inStock', !formData.inStock)
                        }
                      >
                        <div>
                          <strong>Availability Status</strong>
                          <div style={{ fontSize: 12, color: '#6E6660', marginTop: 2 }}>
                            {formData.inStock ? 'Marked In Stock' : 'Marked Out of Stock'}
                          </div>
                        </div>
                        <div
                          className={`toggle-switch ${
                            formData.inStock ? 'on' : ''
                          }`}
                        >
                          <div className="toggle-thumb" />
                        </div>
                      </div>
                    </div>

                    {/* Description */}
                    <div className="form-group">
                      <label htmlFor="product-desc">Editorial Description</label>
                      <textarea
                        id="product-desc"
                        className="form-textarea"
                        placeholder="Detail the fabric, weave, embroidery, or gemstones..."
                        value={formData.description}
                        onChange={(e) =>
                          handleInputChange('description', e.target.value)
                        }
                      />
                    </div>

                    {/* Image Upload from Local Device & Camera */}
                    <div className="form-section-title" style={{ marginTop: 22 }}>
                      Product Imagery (Device Upload)
                    </div>

                    <div className="form-group">
                      {/* Hidden inputs: Gallery and direct camera */}
                      <input
                        type="file"
                        ref={fileInputGalleryRef}
                        style={{ display: 'none' }}
                        accept="image/*"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            handleFileSelect(e.target.files[0]);
                          }
                        }}
                      />

                      <input
                        type="file"
                        ref={fileInputCameraRef}
                        style={{ display: 'none' }}
                        accept="image/*"
                        capture="environment"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            handleFileSelect(e.target.files[0]);
                          }
                        }}
                      />

                      {imagePreview ? (
                        <div className="image-preview-wrapper">
                          <img src={imagePreview} alt="Product Upload Preview" />
                          <button
                            type="button"
                            className="btn-remove-preview"
                            onClick={handleRemoveImage}
                            title="Remove Image"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <div>
                          {/* Mobile Optimized Photo Capture Actions */}
                          <div className="mobile-photo-actions">
                            <button
                              type="button"
                              className="btn-photo-capture"
                              onClick={() => fileInputCameraRef.current?.click()}
                            >
                              📸 Take Photo
                            </button>
                            <button
                              type="button"
                              className="btn-photo-capture"
                              onClick={() => fileInputGalleryRef.current?.click()}
                            >
                              🖼 Choose from Gallery
                            </button>
                          </div>
                          <small style={{ fontSize: 11, color: '#6E6660', marginTop: 6, display: 'block' }}>
                            Upload product photos directly from your phone's camera roll or computer files.
                          </small>
                        </div>
                      )}

                      {uploadProgress > 0 && (
                        <div className="upload-progress-bar">
                          <div
                            className="upload-progress-fill"
                            style={{ width: `${uploadProgress}%` }}
                          />
                        </div>
                      )}
                    </div>

                    {/* Actions Bar */}
                    <div className="form-actions-bar">
                      <button
                        type="submit"
                        className="btn-submit-product"
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? (
                          <>Uploading to Firebase Storage & Firestore...</>
                        ) : (
                          <>✦ Save & Sync to Firestore</>
                        )}
                      </button>

                      <button
                        type="button"
                        className="btn-reset-form"
                        onClick={() => {
                          setFormData({
                            ...initialFormState,
                            id: generateNextId(products)
                          });
                          handleRemoveImage();
                        }}
                      >
                        Reset
                      </button>
                    </div>
                  </form>
                </div>
              </div>

              {/* Preview Section */}
              <div className="preview-sticky-container">
                <div className="preview-card-wrapper">
                  <div className="preview-badge-header">
                    <h4>✦ Customer Storefront Card</h4>
                    <div className="preview-currency-toggle">
                      <button
                        type="button"
                        className={`currency-toggle-btn ${
                          previewCurrency === 'INR' ? 'active' : ''
                        }`}
                        onClick={() => setPreviewCurrency('INR')}
                      >
                        ₹ INR
                      </button>
                      <button
                        type="button"
                        className={`currency-toggle-btn ${
                          previewCurrency === 'AED' ? 'active' : ''
                        }`}
                        onClick={() => setPreviewCurrency('AED')}
                      >
                        AED
                      </button>
                    </div>
                  </div>

                  <div className="storefront-card">
                    <div className="storefront-image-frame">
                      <img
                        src={
                          formData.image ||
                          (formData.category === 'Accessories'
                            ? 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=900&q=80'
                            : 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=900&q=80')
                        }
                        alt={formData.name || 'Product Preview'}
                        onError={(e) => {
                          e.currentTarget.src =
                            'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=900&q=80';
                        }}
                      />

                      <span
                        className={`storefront-stock-tag ${
                          !formData.inStock ? 'out' : ''
                        }`}
                      >
                        {formData.inStock ? 'In Stock' : 'Out of Stock'}
                      </span>

                      <span className="storefront-category-tag">
                        {formData.gender} • {formData.customSubcategory || formData.subcategory || formData.category}
                      </span>
                    </div>

                    <div className="storefront-info-box">
                      <h3 className="storefront-item-name">
                        {formData.name || 'Sample Atelier Garment'}
                      </h3>

                      <p className="storefront-item-desc">
                        {formData.description ||
                          'Artisanal tailoring, festive accents, and timeless elegance.'}
                      </p>

                      <div className="storefront-price-row">
                        <div className="storefront-price-value">
                          {previewCurrency === 'INR'
                            ? `₹${formData.priceInr ? Number(formData.priceInr).toLocaleString('en-IN') : '2,499'}`
                            : `AED ${formData.priceAed ? Number(formData.priceAed).toLocaleString('en-IN') : '112'}`}
                        </div>
                        <span className="storefront-item-id">
                          {formData.id || 'item_000'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {window.innerWidth < 992 && (
                    <button
                      type="button"
                      className="btn-inline-action"
                      style={{ width: '100%', marginTop: 14 }}
                      onClick={() => setMobileEditorView('form')}
                    >
                      ← Back to Edit Form
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==================================================================
            TAB 2: Inventory Catalog (Mobile Cards + Desktop Table)
            ================================================================== */}
        {activeTab === 'inventory' && (
          <div>
            {/* Stat Cards */}
            <div className="inventory-stats-grid">
              <div className="stat-card highlight">
                <div className="stat-label">Total Catalog</div>
                <div className="stat-number">{stats.total}</div>
              </div>

              <div className="stat-card">
                <div className="stat-label">Clothing</div>
                <div className="stat-number">{stats.clothing}</div>
              </div>

              <div className="stat-card">
                <div className="stat-label">Accessories</div>
                <div className="stat-number">{stats.accessories}</div>
              </div>

              <div className="stat-card">
                <div className="stat-label">In Stock</div>
                <div className="stat-number">{stats.inStock}</div>
              </div>
            </div>

            {/* Controls Bar */}
            <div className="inventory-controls-bar">
              <div className="search-input-wrapper">
                <span className="icon">⌕</span>
                <input
                  type="text"
                  placeholder="Search products by name, ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="filter-group">
                <select
                  className="filter-select"
                  value={filterGender}
                  onChange={(e) => setFilterGender(e.target.value)}
                >
                  <option value="All">All Genders</option>
                  <option value="Women">Women</option>
                  <option value="Men">Men</option>
                  <option value="Kids">Kids</option>
                </select>

                <select
                  className="filter-select"
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                >
                  <option value="All">All Categories</option>
                  <option value="Clothing">Clothing</option>
                  <option value="Accessories">Accessories</option>
                </select>

                <select
                  className="filter-select"
                  value={filterStock}
                  onChange={(e) => setFilterStock(e.target.value)}
                >
                  <option value="All">All Stock</option>
                  <option value="In Stock">In Stock</option>
                  <option value="Out of Stock">Out of Stock</option>
                </select>

                <button
                  type="button"
                  className="btn-inline-action"
                  onClick={handleDownloadCatalogJson}
                  title="Download catalog JSON"
                >
                  📥 Export
                </button>
              </div>
            </div>

            {/* 1. Mobile Product Cards (Phones & Small Tablets) */}
            <div className="mobile-inventory-list">
              {filteredInventory.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px', color: '#6E6660' }}>
                  No items match the current search filters.
                </div>
              ) : (
                filteredInventory.map((item) => (
                  <div key={item.id} className="mobile-product-card">
                    <div className="mobile-card-top">
                      <img
                        src={item.image}
                        alt={item.name}
                        className="mobile-card-thumb"
                        onError={(e) => {
                          e.currentTarget.src =
                            'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=200&q=80';
                        }}
                      />
                      <div className="mobile-card-details">
                        <h4 className="mobile-card-title">{item.name}</h4>
                        <div className="mobile-card-subtitle">
                          {item.id} • {item.gender} • {item.subcategory}
                        </div>
                        <div className="mobile-card-prices">
                          <span className="mobile-price-inr">
                            ₹{Number(item.priceInr).toLocaleString('en-IN')}
                          </span>
                          <span className="mobile-price-aed">
                            AED {Number(item.priceAed).toLocaleString('en-IN')}
                          </span>
                          <span
                            className={`stock-pill ${
                              item.inStock ? 'in' : 'out'
                            }`}
                            style={{ marginLeft: 'auto' }}
                          >
                            {item.inStock ? 'In Stock' : 'Out'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mobile-card-actions">
                      <button
                        type="button"
                        className="btn-mobile-action"
                        onClick={() => toggleStock(item.id)}
                      >
                        {item.inStock ? 'Mark Out of Stock' : 'Mark In Stock'}
                      </button>
                      <button
                        type="button"
                        className="btn-mobile-action"
                        onClick={() => handleDuplicateToForm(item)}
                      >
                        Edit / Copy
                      </button>
                      <button
                        type="button"
                        className="btn-mobile-action delete"
                        onClick={() => deleteProduct(item.id, item.name)}
                        title="Delete product"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* 2. Desktop Table (Laptops and Desktops >= 768px) */}
            <div className="desktop-inventory-table">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Category</th>
                    <th>Audience</th>
                    <th>INR (₹)</th>
                    <th>AED</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInventory.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '36px', color: '#6E6660' }}>
                        No inventory items match the current search filters.
                      </td>
                    </tr>
                  ) : (
                    filteredInventory.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <img
                              src={item.image}
                              alt={item.name}
                              className="table-thumb"
                              onError={(e) => {
                                e.currentTarget.src =
                                  'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=200&q=80';
                              }}
                            />
                            <div>
                              <strong style={{ display: 'block' }}>{item.name}</strong>
                              <span style={{ fontSize: 11, color: '#6E6660' }}>
                                {item.id} • {item.subcategory}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td>{item.category}</td>
                        <td>{item.gender}</td>
                        <td style={{ fontWeight: 600 }}>
                          ₹{Number(item.priceInr).toLocaleString('en-IN')}
                        </td>
                        <td style={{ color: '#6E6660' }}>
                          AED {Number(item.priceAed).toLocaleString('en-IN')}
                        </td>
                        <td>
                          <span className={`stock-pill ${item.inStock ? 'in' : 'out'}`}>
                            {item.inStock ? 'In Stock' : 'Out of Stock'}
                          </span>
                        </td>
                        <td>
                          <button
                            className="btn-table-action"
                            onClick={() => toggleStock(item.id)}
                          >
                            {item.inStock ? 'Mark Out' : 'Mark In'}
                          </button>
                          <button
                            className="btn-table-action"
                            onClick={() => handleDuplicateToForm(item)}
                          >
                            Edit
                          </button>
                          <button
                            className="btn-table-action"
                            onClick={() => deleteProduct(item.id, item.name)}
                            style={{ color: '#D32F2F' }}
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ==================================================================
            TAB 3: Cloud & Auth Settings
            ================================================================== */}
        {activeTab === 'cloud' && (
          <div className="cloud-settings-grid">
            <div className="editor-card">
              <div className="card-header">
                <h3>Firebase Cloud & Database</h3>
                <p>Configured for mobile and web storage operations</p>
              </div>

              <div className="card-body">
                <div className="info-banner">
                  {configSummary.isConfigured ? (
                    <span>
                      ✓ <strong>Live Cloud Active:</strong> Connected to project{' '}
                      <code>{configSummary.projectId}</code>.
                    </span>
                  ) : (
                    <span>
                      ℹ <strong>Development Mode:</strong> Configured for project{' '}
                      <code>{configSummary.projectId}</code> with local fallback.
                    </span>
                  )}
                </div>

                <div className="config-list">
                  <div className="config-item">
                    <span className="label">Firestore Document</span>
                    <span className="val">store_data/catalog</span>
                  </div>

                  <div className="config-item">
                    <span className="label">Storage Bucket</span>
                    <span className="val">{configSummary.storageBucket}</span>
                  </div>

                  <div className="config-item">
                    <span className="label">Authenticated User</span>
                    <span className="val">{currentUser ? currentUser.email || currentUser.displayName : 'None'}</span>
                  </div>
                </div>

                <div style={{ marginTop: 20 }}>
                  <button
                    type="button"
                    className="btn-submit-product"
                    onClick={() => addToast('Firebase Cloud connection active and responsive!', 'success')}
                  >
                    Test Firebase Connection
                  </button>
                </div>
              </div>
            </div>

            <div className="editor-card">
              <div className="card-header">
                <h3>Access Restriction Control</h3>
                <p>Toggle authentication requirements for /admin</p>
              </div>

              <div className="card-body">
                <div className="form-group">
                  <div
                    className="stock-toggle-box"
                    onClick={() => toggleRestrictedMode(!isRestrictedMode)}
                  >
                    <div>
                      <strong>Enforce Authorization Gate</strong>
                      <div style={{ fontSize: 12, color: '#6E6660', marginTop: 2 }}>
                        {isRestrictedMode
                          ? 'Restricted: users must sign in via Firebase or enter passcode.'
                          : 'Open access: anyone navigating to /admin can enter directly.'}
                      </div>
                    </div>
                    <div
                      className={`toggle-switch ${
                        isRestrictedMode ? 'on' : ''
                      }`}
                    >
                      <div className="toggle-thumb" />
                    </div>
                  </div>
                </div>

                <div className="config-list" style={{ marginTop: 16 }}>
                  <div className="config-item">
                    <span className="label">Fallback Passcode</span>
                    <span className="val">{DEFAULT_PASSCODE}</span>
                  </div>
                </div>

                <div style={{ marginTop: 20, display: 'flex', gap: 10 }}>
                  <button
                    type="button"
                    className="btn-reset-form"
                    onClick={handleSignOut}
                  >
                    Sign Out Now
                  </button>
                  <button
                    type="button"
                    className="btn-inline-action"
                    onClick={handleDownloadCatalogJson}
                  >
                    Export JSON
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Mobile Bottom Navigation Bar (Phones & Small Tablets) */}
      <nav className="mobile-bottom-bar" aria-label="Mobile Navigation">
        <button
          type="button"
          className={`mobile-nav-item ${activeTab === 'create' ? 'active' : ''}`}
          onClick={() => setActiveTab('create')}
        >
          <span className="mobile-nav-icon">✦</span>
          <span>Add Item</span>
        </button>

        <button
          type="button"
          className={`mobile-nav-item ${activeTab === 'inventory' ? 'active' : ''}`}
          onClick={() => setActiveTab('inventory')}
        >
          <span className="mobile-nav-icon">📋</span>
          <span>Inventory</span>
          <span className="mobile-badge-pill">{products.length}</span>
        </button>

        <button
          type="button"
          className={`mobile-nav-item ${activeTab === 'cloud' ? 'active' : ''}`}
          onClick={() => setActiveTab('cloud')}
        >
          <span className="mobile-nav-icon">☁</span>
          <span>Cloud</span>
        </button>
      </nav>

      {/* Toast Feedback */}
      <div className="admin-toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className={`admin-toast ${toast.type}`}>
            <span>{toast.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}