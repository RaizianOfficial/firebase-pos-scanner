"use client";

import { useAuthGuard } from "@/hooks/useAuthGuard";
import { Navigation } from "@/components/Navigation";
import { useCartStore } from "@/store/useCartStore";
import { useState, useEffect, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { 
  Plus, 
  Minus, 
  Trash2, 
  Search, 
  Scan, 
  CreditCard, 
  Receipt,
  ShoppingCart,
  ChevronRight,
  Loader2,
  Printer,
  Download,
  CheckCircle,
  PackageSearch
} from "lucide-react";
import { db } from "@/lib/firebase/config";
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  serverTimestamp,
  writeBatch,
  doc
} from "firebase/firestore";
import { type Product } from "@/types";
import { jsPDF } from "jspdf";
import AddProductModal from "@/components/AddProductModal";

// Load scanner with dynamic import (SSR disabled)
const Scanner = dynamic(() => import("@/components/Scanner"), { ssr: false });

export default function Home() {
  const { user, loading: authLoading } = useAuthGuard();
  const { items, addItem, removeItem, updateQuantity, updatePrice, clearCart, getTotal } = useCartStore();
  
  const [showScanner, setShowScanner] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [scannedBarcode, setScannedBarcode] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [processing, setProcessing] = useState(false);
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [tempPrice, setTempPrice] = useState<string>("");
  const [receiptPdfUrl, setReceiptPdfUrl] = useState<string | null>(null);
  const [currentReceiptDoc, setCurrentReceiptDoc] = useState<jsPDF | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  }, []);

  // In-memory cache: barcode -> product (avoids repeated Firestore lookups)
  const productCacheRef = useRef<Map<string, Product | null>>(new Map());

  // 1. Initial Data Fetch: Pre-cache ALL products for instant scanning
  useEffect(() => {
    let isMounted = true;
    const preCacheProducts = async () => {
      try {
        const q = query(collection(db, "products"));
        const snapshot = await getDocs(q);
        if (!isMounted) return;
        
        snapshot.forEach((doc) => {
          const product = { id: doc.id, ...doc.data() } as Product;
          if (product.barcode) {
            productCacheRef.current.set(product.barcode, product);
          }
        });
        console.log(`Pre-cached ${productCacheRef.current.size} products for instant scanning.`);
      } catch (err) {
        console.error("Failed to pre-cache products", err);
      }
    };
    preCacheProducts();
    return () => { isMounted = false; };
  }, []);

  // Search logic
  useEffect(() => {
    const searchProducts = async () => {
      if (searchQuery.length < 2) {
        setSearchResults([]);
        return;
      }
      
      const q = query(
        collection(db, "products"),
        where("name", ">=", searchQuery),
        where("name", "<=", searchQuery + "\uf8ff")
      );
      
      const querySnapshot = await getDocs(q);
      const results: Product[] = [];
      querySnapshot.forEach((doc) => {
        results.push({ id: doc.id, ...doc.data() } as Product);
      });
      setSearchResults(results);
    };

    const timeoutId = setTimeout(searchProducts, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const handleScan = useCallback(async (barcode: string) => {
    const cache = productCacheRef.current;

    // 1. Check cache first — instant if already looked up
    if (cache.has(barcode)) {
      const cached = cache.get(barcode);
      if (cached) {
        addItem(cached);
        return true;
      }
    }

    // 2. Not cached — query Firestore
    const q = query(collection(db, "products"), where("barcode", "==", barcode));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const docSnap = querySnapshot.docs[0];
      const product = { id: docSnap.id, ...docSnap.data() } as Product;
      cache.set(barcode, product); // cache it
      addItem(product);
      return true;
    } else {
      // 3. Not found — Show "Add New Product" Modal
      setScannedBarcode(barcode);
      setShowScanner(false);
      setShowAddModal(true);
      return false;
    }
  }, [addItem]);

  const handleCheckout = async () => {
    if (items.length === 0) return;
    setProcessing(true);
    let saleId = "";
    const currentTotal = getTotal();
    const snapItems = [...items]; // snapshot representing the cart

    try {
      const batch = writeBatch(db);
      
      // 1. Create Sale
      const saleRef = doc(collection(db, "sales"));
      saleId = saleRef.id;
      
      batch.set(saleRef, {
        totalAmount: currentTotal,
        createdAt: serverTimestamp(),
      });

      // 2. Create Sale Items
      snapItems.forEach((item) => {
        const saleItemRef = doc(collection(db, "saleItems"));
        batch.set(saleItemRef, {
          saleId: saleId,
          productId: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          createdAt: serverTimestamp(),
        });
      });

      // Execute transaction completely before generating receipt
      await batch.commit();

      try {
        // 3. Generate Thermal Receipt and load into UI Modal instead of auto-downloading immediately 
        const pdfDoc = generateReceipt(saleId, snapItems, currentTotal);
        setCurrentReceiptDoc(pdfDoc);
        // datauristring is widely supported in iframes across all browsers
        const pdfUrl = pdfDoc.output("datauristring") as unknown as string;
        setReceiptPdfUrl(pdfUrl);
      } catch (pdfErr) {
        console.error("PDF Generation error:", pdfErr);
        alert("Bill saved, but receipt generation failed. " + String(pdfErr));
      }

      // 4. Clear Cart on success ONLY
      clearCart();
    } catch (err: any) {
      console.error(err);
      alert(`Checkout Error: ${err?.message || "Please check your database connection or rules."}`);
    } finally {
      setProcessing(false);
    }
  };

  const generateReceipt = (saleId: string, printedItems: any[], total: number) => {
    // 80mm generic thermal printer format
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: [80, 200] // Initial arbitrary height, we usually print exact height but PDF preview is responsive
    });
    
    const pageWidth = 80;
    
    // Header
    doc.setFont("courier", "bold");
    doc.setFontSize(14);
    doc.text("RAIZIAN STORE", pageWidth / 2, 12, { align: "center" });
    
    doc.setFontSize(10);
    doc.setFont("courier", "normal");
    doc.text("---------------------------------------", pageWidth / 2, 18, { align: "center" });

    const now = new Date();
    // Use narrower font spacing specifically for Courier
    doc.text(`Date: ${now.toLocaleDateString()}`, 4, 24);
    doc.text(`Time: ${now.toLocaleTimeString()}`, 4, 29);
    doc.text(`ID:   ${saleId.slice(-6).toUpperCase()}`, 4, 34);

    doc.text("---------------------------------------", pageWidth / 2, 39, { align: "center" });
    
    // Table Header
    doc.text("Item", 4, 44);
    doc.text("Qty", 48, 44, { align: "center" });
    doc.text("Total", 76, 44, { align: "right" });
    
    doc.text("---------------------------------------", pageWidth / 2, 49, { align: "center" });
    
    // Items
    let y = 54;
    printedItems.forEach((item) => {
      let itemName = typeof item.name === "string" ? item.name : "Unknown Item";
      let nameStr = itemName.substring(0, 16); // limit length for thermal realism
      doc.text(nameStr, 4, y);
      
      const qty = item.quantity || 1;
      const price = item.price || 0;
      doc.text(qty.toString(), 48, y, { align: "center" });
      const itemTotal = (price * qty).toFixed(2);
      doc.text(`$${itemTotal}`, 76, y, { align: "right" });
      y += 6;
    });

    // Footer
    doc.text("---------------------------------------", pageWidth / 2, y, { align: "center" });
    y += 8;

    doc.setFontSize(12);
    doc.setFont("courier", "bold");
    doc.text("TOTAL:", 4, y);
    doc.text(`$${total.toFixed(2)}`, 76, y, { align: "right" });
    
    y += 8;
    doc.setFontSize(10);
    doc.setFont("courier", "normal");
    doc.text("=======================================", pageWidth / 2, y, { align: "center" });
    
    y += 8;
    doc.text("Thank you for shopping!", pageWidth / 2, y, { align: "center" });
    y += 6;
    doc.text("Please visit again.", pageWidth / 2, y, { align: "center" });
    
    return doc;
  };

  if (authLoading) return <div className="flex h-screen items-center justify-center bg-slate-50">
    <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-black"></div>
  </div>;

  return (
    <div className="min-h-screen bg-slate-50">
      <Navigation />
      
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          
          {/* Left Column: Search and Results (7 cols) */}
          <div className="lg:col-span-8 flex flex-col gap-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
               <div className="flex flex-col sm:flex-row gap-4 items-center">
                  <div className="relative flex-1 group w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-neutral-600 transition-colors" size={20} />
                    <input
                      type="text"
                      placeholder="Search items by name..."
                      className="w-full rounded-xl border border-slate-200 py-3 pl-10 pr-4 outline-none focus:border-black bg-slate-50 transition-all font-medium"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <button
                    onClick={() => setShowScanner(true)}
                    className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-black px-6 py-3 font-bold text-white transition-all hover:bg-neutral-800 active:scale-95 shadow-lg shadow-neutral-300"
                  >
                    <Scan size={20} /> SCAN BARCODE
                  </button>
               </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex-1 min-h-[400px]">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-4 mb-4">
                 <PackageSearch className="text-slate-400" size={20} />
                 <h2 className="font-bold text-slate-800 tracking-tight">Search Results</h2>
              </div>
              
              {searchResults.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {searchResults.map((product) => (
                    <div
                      key={product.id}
                      className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-100 p-4 transition-all hover:border-black hover:bg-neutral-100/50 group"
                      onClick={() => {
                        addItem(product);
                        showToast(`Added ${product.name} to cart`);
                      }}
                    >
                      <div>
                        <p className="font-bold text-slate-900 group-hover:text-neutral-800 mb-0.5">{product.name}</p>
                        <p className="text-sm font-semibold text-black">${product.price.toFixed(2)}</p>
                      </div>
                      <Plus className="text-slate-300 group-hover:text-black" size={20} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 py-12">
                   <div className="bg-slate-50 p-4 rounded-full mb-4">
                      <Search size={40} />
                   </div>
                   <p className="font-medium">No results found or waiting for search</p>
                   <p className="text-xs">Try searching for a product name</p>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Cart (5 cols) */}
          <div className="lg:col-span-4 flex flex-col gap-6 sticky top-[88px] h-[calc(100vh-120px)] overflow-hidden">
             <div className="bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col h-full">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                   <div className="flex items-center gap-2">
                       <ShoppingCart className="text-black" size={22} />
                       <h2 className="text-xl font-bold text-slate-900">Cart</h2>
                   </div>
                   <span className="bg-neutral-200 text-neutral-800 px-3 py-0.5 rounded-full text-sm font-bold">
                      {items.reduce((acc, item) => acc + item.quantity, 0)} items
                   </span>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                  {items.length > 0 ? (
                    items.map((item) => (
                      <div key={item.id} className="flex flex-col rounded-xl border border-slate-100 p-3 bg-slate-50/50">
                        <div className="flex justify-between items-start mb-2 gap-2">
                           <p className="font-bold text-slate-800 line-clamp-2 leading-tight">{item.name}</p>
                           <div className="flex flex-col items-end">
                              <p className="font-bold text-black text-sm whitespace-nowrap">${(item.price * item.quantity).toFixed(2)}</p>
                              
                              {/* Inline price edit for manually adjusting newly added $0 items */}
                              {editingPriceId === item.id ? (
                                <div className="flex items-center gap-1 mt-1">
                                  <span className="text-xs text-slate-500">$</span>
                                  <input 
                                    type="number" 
                                    autoFocus
                                    className="w-16 px-1 py-0.5 text-xs border border-black rounded outline-none"
                                    value={tempPrice}
                                    onChange={(e) => setTempPrice(e.target.value)}
                                    onBlur={() => {
                                      const newPrice = parseFloat(tempPrice);
                                      if (!isNaN(newPrice) && newPrice >= 0) {
                                        updatePrice(item.id, newPrice);
                                      }
                                      setEditingPriceId(null);
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        const newPrice = parseFloat(tempPrice);
                                        if (!isNaN(newPrice) && newPrice >= 0) {
                                          updatePrice(item.id, newPrice);
                                        }
                                        setEditingPriceId(null);
                                      }
                                    }}
                                  />
                                </div>
                              ) : (
                                <p 
                                  className="text-[10px] text-slate-400 cursor-pointer hover:text-neutral-600 hover:underline mt-0.5"
                                  onClick={() => {
                                    setTempPrice(item.price.toString());
                                    setEditingPriceId(item.id);
                                  }}
                                >
                                  @{item.price.toFixed(2)} /ea
                                </p>
                              )}
                           </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => updateQuantity(item.id, item.quantity - 1)}
                              className="rounded-lg bg-white p-1 hover:bg-red-50 hover:text-red-500 border border-slate-100 shadow-sm transition-transform active:scale-90"
                            >
                              <Minus size={14} />
                            </button>
                            <span className="font-bold text-slate-700 min-w-[20px] text-center animate-in zoom-in duration-200" key={item.quantity}>{item.quantity}</span>
                            <button
                              onClick={() => updateQuantity(item.id, item.quantity + 1)}
                              className="rounded-lg bg-white p-1 hover:bg-neutral-100 hover:text-neutral-600 border border-slate-100 shadow-sm transition-transform active:scale-90"
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                          <button
                            onClick={() => removeItem(item.id)}
                            className="text-red-400 p-1.5 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-slate-300 py-12">
                       <ShoppingCart size={48} className="mb-4 opacity-50" />
                       <p className="font-bold">Your cart is empty</p>
                    </div>
                  )}
                </div>

                <div className="p-6 bg-slate-50 border-t border-slate-200 rounded-b-2xl">
                   <div className="flex justify-between items-center mb-6">
                      <span className="text-slate-500 font-semibold uppercase tracking-wider text-xs">Payable Amount</span>
                      <span key={getTotal()} className="text-4xl font-extrabold text-slate-900 animate-in slide-in-from-bottom-2 fade-in duration-300">
                        ${getTotal().toFixed(2)}
                      </span>
                   </div>
                    <button
                     onClick={handleCheckout}
                     disabled={items.length === 0 || processing}
                     className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-900 py-4 font-bold text-white transition-all hover:bg-slate-800 active:scale-95 disabled:bg-slate-300 shadow-xl shadow-slate-200"
                    >
                     {processing ? (
                       <>
                         <Loader2 className="animate-spin" size={20} />
                         GENERATING BILL...
                       </>
                     ) : (
                       <><CreditCard size={20} /> CHECKOUT & PRINT</>
                     )}
                    </button>
                </div>
             </div>
          </div>
        </div>
      </main>

      {/* Conditionally rendered scanners and modals */}
      {showScanner && (
        <Scanner 
          onScan={handleScan} 
          onClose={() => setShowScanner(false)} 
        />
      )}

      {showAddModal && (
        <AddProductModal
          initialBarcode={scannedBarcode}
          onSuccess={(product) => {
            addItem(product);
            setShowAddModal(false);
            showToast("New product created");
          }}
          onClose={() => setShowAddModal(false)}
        />
      )}
      
      {/* Receipt Preview Modal */}
      {receiptPdfUrl && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-2xl bg-slate-100 rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
            <div className="flex items-center justify-between p-4 bg-white border-b border-slate-200">
               <div className="flex items-center gap-2">
                 <Receipt className="text-slate-600" size={20} />
                 <h2 className="font-bold text-slate-800">Receipt Generated</h2>
               </div>
               <button 
                 onClick={() => {
                    setReceiptPdfUrl(null);
                    setCurrentReceiptDoc(null);
                 }}
                 className="text-slate-500 hover:text-slate-800 font-bold px-3 py-1 rounded hover:bg-slate-100"
               >
                 Close
               </button>
            </div>
            
            {/* The PDF Preview */}
            <div className="flex-1 p-4 bg-slate-200 overflow-hidden">
               <iframe 
                 src={receiptPdfUrl} 
                 className="w-full h-[50vh] rounded-lg shadow-sm bg-white" 
                 title="Receipt Preview"
               />
            </div>

            <div className="p-4 bg-white border-t border-slate-200 flex justify-end gap-3">
               <button 
                 onClick={() => currentReceiptDoc?.autoPrint({variant: 'javascript'})}
                 className="flex items-center gap-2 px-6 py-2.5 bg-transparent border-2 border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-xl text-sm transition-all"
               >
                 <Printer size={18} /> Print Receipt
               </button>
               <button 
                 onClick={() => currentReceiptDoc?.save("receipt.pdf")}
                 className="flex items-center gap-2 px-6 py-2.5 bg-black hover:bg-neutral-800 text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-neutral-300"
               >
                 <Download size={18} /> Download PDF
               </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] bg-slate-900 border border-slate-700 text-white px-6 py-3 rounded-full shadow-2xl shadow-slate-900/50 font-bold text-sm flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
           {toastMessage.toLowerCase().includes("created") ? <CheckCircle size={18} className="text-green-400" /> : <ShoppingCart size={18} className="text-white" />}
           {toastMessage}
        </div>
      )}

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: #e2e8f0;
          border-radius: 20px;
        }
      `}</style>
    </div>
  );
}
