import React, { useState, useEffect } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { Hero } from '@/components/store/Hero';
import { Marquee } from '@/components/store/Marquee';
import { Catalog } from '@/components/store/Catalog';
import { HowItWorks } from '@/components/store/HowItWorks';
import { Testimonials } from '@/components/store/Testimonials';
import { Footer } from '@/components/layout/Footer';
import { ProductModal } from '@/components/store/ProductModal';
import { api } from '@/lib/api';
import { toast } from 'sonner';

export default function Home() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);

  const fetchProducts = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await api.get('/products');
      const list = Array.isArray(res.data?.products) ? res.data.products : Array.isArray(res.data) ? res.data : [];
      const berandaOnly = list.filter(
        (p) =>
          p &&
          p.product_type !== 'topup' &&
          String(p.category || '').toLowerCase() !== 'topup game' &&
          !p.denomination_code &&
          !p.denomination &&
          !String(p.id || '').startsWith('tp-') &&
          !String(p.id || '').startsWith('topup-')
      );
      setProducts(berandaOnly);
    } catch (err) {
      console.error(err);
      setLoadError(true);
      toast.error("Gagal memuat produk. Periksa koneksi lalu coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  return (
    <main className="min-h-screen bg-background">
      <Navbar />
      <Hero products={products} onSelect={setSelectedProduct} />
      <Marquee />
      {loadError && !loading ? (
        <section id="katalog" className="max-w-7xl mx-auto px-4 py-20 text-center" data-testid="catalog-error">
          <p className="text-sm font-mono text-coral">Gagal memuat produk. Periksa koneksi internet kamu.</p>
          <button
            onClick={fetchProducts}
            data-testid="catalog-retry-button"
            className="mt-6 bg-neon text-void font-display font-bold text-xs uppercase tracking-[0.2em] px-6 py-3 hover:bg-lime transition-colors"
          >
            Coba Lagi
          </button>
        </section>
      ) : (
        <Catalog products={products} loading={loading} onSelect={setSelectedProduct} />
      )}
      <HowItWorks />
      <Testimonials />
      <Footer />
      {selectedProduct && (
        <ProductModal 
          product={selectedProduct} 
          products={products}
          onSelectProduct={setSelectedProduct}
          onClose={() => setSelectedProduct(null)} 
        />
      )}
    </main>
  );
}
