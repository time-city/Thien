import { create } from "zustand";
import React from "react";

interface ConfirmOptions {
  title: string;
  message: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  onConfirm: () => Promise<void> | void;
}

interface ConfirmStore extends ConfirmOptions {
  isOpen: boolean;
  isLoading: boolean;
  openConfirm: (options: ConfirmOptions) => void;
  closeConfirm: () => void;
  setLoading: (isLoading: boolean) => void;
}

export const useConfirmStore = create<ConfirmStore>((set) => ({
  isOpen: false,
  isLoading: false,
  title: "",
  message: "",
  confirmText: "Xác nhận",
  cancelText: "Hủy",
  isDestructive: false,
  onConfirm: () => {},
  
  openConfirm: (options) =>
    set({
      ...options,
      isOpen: true,
      isLoading: false,
      confirmText: options.confirmText || "Xác nhận",
      cancelText: options.cancelText || "Hủy",
      isDestructive: options.isDestructive ?? false,
    }),
    
  closeConfirm: () => set({ isOpen: false, isLoading: false }),
  setLoading: (isLoading) => set({ isLoading }),
}));