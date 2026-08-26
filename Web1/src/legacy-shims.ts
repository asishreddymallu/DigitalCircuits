/**
 * Global type augmentations carried over from the pre-modular codebase.
 * These keep the `window.StudioFX` / `window.toggleSiteTheme` calls
 * type-safe without polluting every module with interface declarations.
 */

interface StudioFX {
    click(isHigh: boolean): void;
    success(): void;
    tick(): void;
    relay(): void;
}

interface Window {
    StudioFX?: StudioFX;
    toggleSiteTheme?: () => void;
    toggleSiteSound?: () => void;
}
