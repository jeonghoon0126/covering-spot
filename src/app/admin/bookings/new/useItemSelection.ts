"use client";

import { useState, useEffect } from "react";
import type { BookingItem } from "@/types/booking";

export interface SpotItem {
  category: string;
  name: string;
  displayName: string;
  price: number;
  loadingCube: number;
}

export interface SpotCategory {
  name: string;
  items: SpotItem[];
}

export function formatPrice(n: number): string {
  return n.toLocaleString("ko-KR");
}

interface UseItemSelectionReturn {
  categories: SpotCategory[];
  selectedItems: BookingItem[];
  setSelectedItems: React.Dispatch<React.SetStateAction<BookingItem[]>>;
  itemSearch: string;
  setItemSearch: (v: string) => void;
  openCat: string | null;
  setOpenCat: (v: string | null) => void;
  customItemName: string;
  setCustomItemName: (v: string) => void;
  priceOverride: string;
  setPriceOverride: (v: string) => void;
  itemsTotal: number;
  totalLoadingCube: number;
  filteredItems: SpotItem[];
  getItemQty: (cat: string, name: string) => number;
  updateItemQty: (
    cat: string,
    name: string,
    displayName: string,
    price: number,
    loadingCube: number,
    delta: number,
  ) => void;
  addCustomItem: () => void;
}

export function useItemSelection(): UseItemSelectionReturn {
  const [categories, setCategories] = useState<SpotCategory[]>([]);
  const [selectedItems, setSelectedItems] = useState<BookingItem[]>([]);
  const [itemSearch, setItemSearch] = useState("");
  const [openCat, setOpenCat] = useState<string | null>(null);
  const [customItemName, setCustomItemName] = useState("");
  const [priceOverride, setPriceOverride] = useState("");

  const itemsTotal = selectedItems.reduce((s, i) => s + i.price * i.quantity, 0);
  const totalLoadingCube = selectedItems.reduce((s, i) => s + i.loadingCube * i.quantity, 0);

  useEffect(() => {
    fetch("/api/items")
      .then((r) => r.json())
      .then((d) => setCategories(d.categories || []));
  }, []);

  const filteredItems: SpotItem[] =
    itemSearch.trim().length >= 1
      ? categories
          .flatMap((cat) =>
            cat.items
              .filter(
                (item) =>
                  item.name.toLowerCase().includes(itemSearch.toLowerCase()) ||
                  cat.name.toLowerCase().includes(itemSearch.toLowerCase()),
              )
              .map((item) => ({ ...item, category: cat.name })),
          )
          .slice(0, 40)
      : [];

  function getItemQty(cat: string, name: string): number {
    return selectedItems.find((i) => i.category === cat && i.name === name)?.quantity ?? 0;
  }

  function updateItemQty(
    cat: string,
    name: string,
    displayName: string,
    price: number,
    loadingCube: number,
    delta: number,
  ) {
    setSelectedItems((prev) => {
      const idx = prev.findIndex((i) => i.category === cat && i.name === name);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + delta };
        if (next[idx].quantity <= 0) next.splice(idx, 1);
        return next;
      }
      if (delta > 0) {
        return [...prev, { category: cat, name, displayName, price, quantity: 1, loadingCube }];
      }
      return prev;
    });
  }

  function addCustomItem() {
    const trimmed = customItemName.trim();
    if (!trimmed) return;
    updateItemQty("직접입력", trimmed, trimmed, 0, 0, 1);
    setCustomItemName("");
  }

  return {
    categories,
    selectedItems,
    setSelectedItems,
    itemSearch,
    setItemSearch,
    openCat,
    setOpenCat,
    customItemName,
    setCustomItemName,
    priceOverride,
    setPriceOverride,
    itemsTotal,
    totalLoadingCube,
    filteredItems,
    getItemQty,
    updateItemQty,
    addCustomItem,
  };
}
