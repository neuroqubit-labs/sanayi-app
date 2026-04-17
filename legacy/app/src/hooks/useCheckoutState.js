import { useState, useCallback } from 'react';
import { createOrder } from '../data/purchaseData';

const ORDERS_KEY = 'sanayi_orders';

// ── Order persistence ──

function loadOrders() {
    try {
        const raw = localStorage.getItem(ORDERS_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

function saveOrderToStorage(order) {
    const orders = loadOrders();
    orders.unshift(order);
    localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
}

export function getOrders() {
    return loadOrders();
}

export function getOrder(orderId) {
    return loadOrders().find(o => o.id === orderId) || null;
}

// ── Checkout hook ──

export function useCheckoutState() {
    const [selectedSlots, setSelectedSlots] = useState([]);
    const [paymentMethod, setPaymentMethod] = useState(null);
    const [termsAccepted, setTermsAccepted] = useState(false);

    const hasSlot = selectedSlots.length > 0 && selectedSlots[0].ranges.length > 0;
    const isComplete = hasSlot && paymentMethod && termsAccepted;

    const resetCheckout = useCallback(() => {
        setSelectedSlots([]);
        setPaymentMethod(null);
        setTermsAccepted(false);
    }, []);

    const confirmOrder = useCallback((packageData, vehicle) => {
        const slot = selectedSlots[0] || null;
        const order = createOrder(packageData, vehicle, slot, paymentMethod);
        saveOrderToStorage(order);
        resetCheckout();
        return order;
    }, [selectedSlots, paymentMethod, resetCheckout]);

    return {
        selectedSlots,
        setSelectedSlots,
        paymentMethod,
        setPaymentMethod,
        termsAccepted,
        setTermsAccepted,
        isComplete,
        confirmOrder,
        resetCheckout,
    };
}
