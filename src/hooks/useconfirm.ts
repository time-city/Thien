import { useConfirmStore } from "@/components/store/useConfirmStore";

export const useConfirm = () => {
  const openConfirm = useConfirmStore((state) => state.openConfirm);
  const closeConfirm = useConfirmStore((state) => state.closeConfirm);

  return { confirm: openConfirm, close: closeConfirm };
};