import { List } from "@raycast/api";
import { Vault } from "../api/vault/vault.types";
import { VaultSelection } from "./VaultSelection";
import { useEffect, useState } from "react";
import { getDefaultVault, updateLastAccessed } from "../utils/vault-context";
import { GlobalPreferences } from "../utils/preferences";
import { EnhancedVault } from "../utils/vault-config";

interface SmartVaultSelectionProps {
  vaults: Vault[];
  target: (vault: Vault) => React.ReactNode;
  preferences: GlobalPreferences;
  allowAllVaults?: boolean;
  onAllVaults?: () => React.ReactNode;
  forceSelection?: boolean; // Force showing selection even if useActiveVaultAsDefault is true
}

/**
 * Smart vault selection component that:
 * - Auto-selects active vault if useActiveVaultAsDefault is enabled
 * - Auto-selects if only one vault exists
 * - Shows VaultSelection otherwise
 * - Supports forcing selection view with keyboard shortcut
 */
export function SmartVaultSelection(props: SmartVaultSelectionProps) {
  const { vaults, target, preferences, allowAllVaults = false, onAllVaults, forceSelection = false } = props;
  const [defaultVault, setDefaultVault] = useState<EnhancedVault | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [shouldShowSelection, setShouldShowSelection] = useState(false);

  useEffect(() => {
    async function determineVault() {
      setIsLoading(true);

      // If forced to show selection, skip auto-selection
      if (forceSelection) {
        setShouldShowSelection(true);
        setIsLoading(false);
        return;
      }

      // If only one vault, auto-select it
      if (vaults.length === 1) {
        const vault = vaults[0];
        await updateLastAccessed(vault.key);
        setShouldShowSelection(false);
        setDefaultVault(null);
        setIsLoading(false);
        return;
      }

      // If no vaults, show empty state
      if (vaults.length === 0) {
        setShouldShowSelection(false);
        setDefaultVault(null);
        setIsLoading(false);
        return;
      }

      // Check if useActiveVaultAsDefault is enabled
      if (preferences.useActiveVaultAsDefault) {
        const vault = await getDefaultVault(vaults);
        if (vault) {
          await updateLastAccessed(vault.key);
          setDefaultVault(vault);
          setShouldShowSelection(false);
          setIsLoading(false);
          return;
        }
      }

      // Show selection if no default was found or preference is disabled
      setShouldShowSelection(true);
      setIsLoading(false);
    }

    determineVault();
  }, [vaults, preferences.useActiveVaultAsDefault, forceSelection]);

  if (isLoading) {
    return <List isLoading={true} />;
  }

  // Show vault selection
  if (shouldShowSelection) {
    return <VaultSelection vaults={vaults} target={target} allowAllVaults={allowAllVaults} onAllVaults={onAllVaults} />;
  }

  // Auto-select single vault
  if (vaults.length === 1) {
    return <>{target(vaults[0])}</>;
  }

  // Auto-select default vault
  if (defaultVault) {
    return <>{target(defaultVault)}</>;
  }

  // Fallback to vault selection
  return <VaultSelection vaults={vaults} target={target} allowAllVaults={allowAllVaults} onAllVaults={onAllVaults} />;
}
