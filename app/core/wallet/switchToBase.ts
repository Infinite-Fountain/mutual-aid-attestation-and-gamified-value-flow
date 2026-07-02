import { BASE_CHAIN_ID_HEX } from '../eas/constants'

export async function switchWalletToBase(): Promise<void> {
  const anyWindow = window as Window & { ethereum?: { request: (args: unknown) => Promise<unknown> } }
  if (!anyWindow.ethereum) {
    throw new Error('Ethereum provider not found. Install MetaMask or open in a browser with a wallet.')
  }

  try {
    await anyWindow.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: BASE_CHAIN_ID_HEX }],
    })
  } catch (switchError: unknown) {
    const err = switchError as { code?: number }
    if (err.code === 4902) {
      await anyWindow.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: BASE_CHAIN_ID_HEX,
            chainName: 'Base',
            nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
            rpcUrls: ['https://mainnet.base.org'],
            blockExplorerUrls: ['https://basescan.org'],
          },
        ],
      })
      return
    }
    throw switchError
  }
}
