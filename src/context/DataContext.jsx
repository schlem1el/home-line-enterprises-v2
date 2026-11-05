import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { db } from '../firebaseConfig';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, setDoc } from 'firebase/firestore';
import { useAuth } from './AuthContext';
import { paymentStatusOf } from '../utils/businessRules';
import { round2 } from '../utils/format';

const DataContext = createContext(null);
export const useData = () => useContext(DataContext);

const COLLECTIONS = [
  'suppliers', 'categories', 'products', 'inventory', 'supplier_products',
  'customers',
  'purchases', 'purchase_staff_view', 'purchase_details',
  'supplier_deliveries', 'supplier_payments',
  'sales', 'sale_details', 'customer_payments', 'payment_terms', 'customer_deliveries'
];

export function DataProvider({ children }) {
  const { loading: authLoading, isActive } = useAuth();
  const [data, setData] = useState(Object.fromEntries(COLLECTIONS.map((c) => [c, []])));
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (authLoading || !isActive) return;
    setLoading(true);
    const next = {};
    const failedCollections = new Set();
    await Promise.all(COLLECTIONS.map(async (name) => {
      try {
        const snap = await getDocs(collection(db, name));
        next[name] = snap.docs.map((d) => ({ ...d.data(), _docId: d.id }));
      } catch (err) {
        console.warn(`Skipping ${name}:`, err?.code || err?.message);
        failedCollections.add(name);
        next[name] = [];
      }
    }));
    if (!failedCollections.has('customer_payments')) {
      const paidBySale = new Map();
      next.customer_payments.forEach((payment) => {
        paidBySale.set(payment.sale_id, (paidBySale.get(payment.sale_id) || 0) + (Number(payment.amount) || 0));
      });
      next.sales = next.sales.map((sale) => {
        const amountPaid = round2(paidBySale.get(sale.sale_id) || 0);
        return { ...sale, amount_paid: amountPaid, payment_status: paymentStatusOf(sale.total_amount, amountPaid) };
      });
    }
    if (!failedCollections.has('supplier_payments')) {
      const paidByPurchase = new Map();
      next.supplier_payments.forEach((payment) => {
        paidByPurchase.set(payment.purchase_id, (paidByPurchase.get(payment.purchase_id) || 0) + (Number(payment.amount) || 0));
      });
      next.purchases = next.purchases.map((purchase) => {
        const amountPaid = round2(paidByPurchase.get(purchase.purchase_id) || 0);
        return { ...purchase, payment_status: paymentStatusOf(purchase.total_amount, amountPaid) };
      });
    }
    setData(next);
    setLoading(false);
  }, [authLoading, isActive]);

  useEffect(() => { refresh(); }, [refresh]);

  const add = useCallback(async (coll, payload, idField) => {
    if (idField && payload[idField] !== undefined) {
      await setDoc(doc(db, coll, String(payload[idField])), payload);
      return payload[idField];
    }
    const ref = await addDoc(collection(db, coll), payload);
    return ref.id;
  }, []);

  const update = useCallback(async (coll, id, payload) => {
    await updateDoc(doc(db, coll, String(id)), payload);
  }, []);

  const remove = useCallback(async (coll, id) => {
    await deleteDoc(doc(db, coll, String(id)));
  }, []);

  const lookups = useMemo(() => ({
    supplierById: (id) => data.suppliers.find((s) => s.supplier_id === Number(id)),
    productById: (id) => data.products.find((p) => p.product_id === Number(id)),
    categoryById: (id) => data.categories.find((c) => c.category_id === Number(id)),
    customerById: (id) => data.customers.find((c) => c.customer_id === Number(id)),
    saleById: (id) => data.sales.find((s) => s.sale_id === Number(id)),
    purchaseById: (id) => data.purchases.find((p) => p.purchase_id === Number(id)),
    staffPurchaseById: (id) => data.purchase_staff_view.find((p) => p.purchase_id === Number(id)),
    inventoryByProduct: (pid) => data.inventory.find((i) => i.product_id === Number(pid)),
    supplierProduct: (sid, pid) => data.supplier_products.find(
      (sp) => sp.supplier_id === Number(sid) && sp.product_id === Number(pid)
    ),
    saleDetailsOf: (saleId) => data.sale_details.filter((d) => d.sale_id === Number(saleId)),
    detailsOf: (purchaseId) => data.purchase_details.filter((d) => d.purchase_id === Number(purchaseId)),
    categoryName: (id) => {
      const c = data.categories.find((x) => x.category_id === Number(id));
      return c ? c.category_name : '—';
    },
    saleCustomerName: (s) => s.customer_id
      ? (data.customers.find((c) => c.customer_id === s.customer_id)?.customer_name || '—')
      : 'Walk-in Customer',
  }), [data]);

  const value = useMemo(
    () => ({ data, loading, refresh, add, update, remove, ...lookups }),
    [data, loading, refresh, add, update, remove, lookups]
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}