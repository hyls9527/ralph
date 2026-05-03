import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import { tauri } from '../../services/tauri';
import type { ProjectRecommendation } from '../../types';

export interface FavoriteState {
  favorites: Set<string>;
  pending: Set<string>;

  loadFavorites: () => Promise<void>;
  toggleFavorite: (
    fullName: string,
    project?: ProjectRecommendation,
  ) => Promise<void>;
  isFavorite: (fullName: string) => boolean;
  isPending: (fullName: string) => boolean;
}

export const useFavoriteStore = create<FavoriteState>()(
  persist(
    (set, get) => ({
      favorites: new Set<string>(),
      pending: new Set<string>(),

      loadFavorites: async () => {
        try {
          const data = await tauri.getFavorites();
          const favorites = new Set(data.map((f) => f.fullName));
          set({ favorites });
        } catch (error) {
          alert(
            '加载收藏夹失败: ' +
              (error instanceof Error ? error.message : String(error)),
          );
        }
      },

      toggleFavorite: async (fullName, project) => {
        const { favorites, pending } = get();

        if (pending.has(fullName)) return;

        const newFavorites = new Set(favorites);
        let newPending = new Set(pending);

        if (newFavorites.has(fullName)) {
          newFavorites.delete(fullName);
          newPending.add(fullName);
          set({ favorites: newFavorites, pending: newPending });

          try {
            await tauri.removeFavorite(fullName);
          } catch (error) {
            newFavorites.add(fullName);
            alert(
              '移除收藏失败: ' +
                (error instanceof Error ? error.message : String(error)),
            );
          } finally {
            newPending.delete(fullName);
            set({ pending: newPending });
          }
        } else {
          newFavorites.add(fullName);
          newPending.add(fullName);
          set({ favorites: newFavorites, pending: newPending });

          try {
            await tauri.addFavorite(fullName, JSON.stringify(project || {}));
          } catch (error) {
            newFavorites.delete(fullName);
            alert(
              '添加收藏失败: ' +
                (error instanceof Error ? error.message : String(error)),
            );
          } finally {
            newPending.delete(fullName);
            set({ pending: newPending });
          }
        }
      },

      isFavorite: (fullName) => get().favorites.has(fullName),
      isPending: (fullName) => get().pending.has(fullName),
    }),
    {
      name: 'ralph-favorites-v3',
      version: 3,
      partialize: (state) => ({ favorites: Array.from(state.favorites) }),
    },
  ),
);

export function useFavoriteSelector() {
  return useFavoriteStore(
    useShallow((state) => ({
      favorites: state.favorites,
      pending: state.pending,
      isFavorite: state.isFavorite,
      isPending: state.isPending,
      toggleFavorite: state.toggleFavorite,
      loadFavorites: state.loadFavorites,
    })),
  );
}
