# Live deployments

Deployed by the team's burner key from this repo's scripts. Pool tokens are mocks with no value.
Generated from Foundry broadcast receipts. Every hash links to the explorer.

## Unichain Sepolia (chain 1301)

| Contract | Address |
| --- | --- |
| Aqua registry | [`0x8D9436f8c5bCA114E1C57647505b4C46e03F0D07`](https://sepolia.uniscan.xyz/address/0x8D9436f8c5bCA114E1C57647505b4C46e03F0D07) |
| WalletDeskRouter (modified SwapVM) | [`0x4a4a0Ac5C8B4d9745870549800200d8b4Bd86757`](https://sepolia.uniscan.xyz/address/0x4a4a0Ac5C8B4d9745870549800200d8b4Bd86757) |
| OverflowHook | [`0x9b647cD39D9909FFE56449507058D16F9bBb4088`](https://sepolia.uniscan.xyz/address/0x9b647cD39D9909FFE56449507058D16F9bBb4088) |
| OverflowRouter | [`0xAAA2319f9BcB7e3B6291F9a992931214FC6bFB70`](https://sepolia.uniscan.xyz/address/0xAAA2319f9BcB7e3B6291F9a992931214FC6bFB70) |
| DeskPriceFeed (CRE consumer) | [`0xb1749dDDd701D99a9f318610a7A6962b11409c82`](https://sepolia.uniscan.xyz/address/0xb1749dDDd701D99a9f318610a7A6962b11409c82) |
| OrderBuilder | [`0x89325CFc9f1509aa11c3399a9d00848b561C099a`](https://sepolia.uniscan.xyz/address/0x89325CFc9f1509aa11c3399a9d00848b561C099a) |
| Demo token0 (mock) | [`0x6b5D58110388AbaFD92Aa28CdD6Bb81cb6dDeE90`](https://sepolia.uniscan.xyz/address/0x6b5D58110388AbaFD92Aa28CdD6Bb81cb6dDeE90) |
| Demo token1 (mock) | [`0xc68102a658c0c39625b9b7F8e500eea07a934f31`](https://sepolia.uniscan.xyz/address/0xc68102a658c0c39625b9b7F8e500eea07a934f31) |
| Uniswap v4 PoolManager (canonical) | [`0x00B036B58a818B1BC34d502D3fE730Db729e62AC`](https://sepolia.uniscan.xyz/address/0x00B036B58a818B1BC34d502D3fE730Db729e62AC) |
| Pool id | `0xae93c1bd88e46a2fae33d97774b45f23f4b50d09592456487f208e1314bda1fe` |

### What to look at (Unichain Sepolia)

| Proof | Transaction |
| --- | --- |
| Maker ships a DeskBand strategy on Aqua; tokens stay in the wallet | [ship](https://sepolia.uniscan.xyz/tx/0x495fb08365fc9bc96679c21cfb056506d8b41c525e910c07a7f0031f02824378) |
| Desk registered on the hook with a 100 bps price guard | [registerDesk](https://sepolia.uniscan.xyz/tx/0x780c3ddbe89eee9ae751b617ed925f8d85219cac330b7a4c0f3c2aa5af3c91b1) |
| Reference price written to `DeskPriceFeed` | [onReport](https://sepolia.uniscan.xyz/tx/0xfecb972a665dcb1d6ddbaf6bda19a890db51a890f52b273dcafa389d96e51909) |
| Overflow swap through OverflowRouter: pool fills 1, the maker wallet fills 4 via Aqua `Pulled` / `Pushed` | [swapExactInput](https://sepolia.uniscan.xyz/tx/0x0c169e96abd27278b2330755717034dc30bc5d7eed5be48dbc48dbc43bff0340) |
| Overflow swap through Uniswap's stock `PoolSwapTest`: the desk fills a router it does not know | [swap](https://sepolia.uniscan.xyz/tx/0x8d2b81fe61e8d7f5ea1187e32b6d8ad81904df3b3de595556a7809286f305d6e) |
| Feed handed to the Chainlink CRE forwarder (`0x6E9EE680ef59ef64Aa8C7371279c27E496b5eDc1`) for the CRE run | [setForwarder](https://sepolia.uniscan.xyz/tx/0xde2f045b38e5019f3f4c9d29bc2d3b99ef239027e52690faf626d4669f389c2d) |

Aqua is not deployed on Unichain Sepolia, so the registry above is the unmodified 1inch Aqua deployed by
`DeployUnichainSepolia` (`DEPLOY_AQUA=true`). On Unichain mainnet the desk uses the live Aqua registry.

### Maintenance (6 Nov 2026, about 21:35 IST)

The Chainlink CRE workflow is simulated, not deployed to a DON (deploy access is pending), so nothing refreshes the
Sepolia reference on a schedule. Once it was more than an hour old, the hook correctly failed closed and skipped every
desk. To keep the public demo usable, the hook owner set the demo's `maxReferenceAge` to 30 days, took the forwarder
role back for one report with a fresh Coinbase + Kraken median, and returned it to the CRE simulation forwarder.
Production settings stay one hour with CRE writing every 30 seconds.

| Step | Transaction |
| --- | --- |
| `setPriceFeed(feed, 2592000)` (30-day demo window) | [`0xf202687a…`](https://sepolia.uniscan.xyz/tx/0xf202687a5f610698e9c9edb8e59d5b656dffbe9d6620379909e20b4afaa9b6d8) |
| `setForwarder(burner)` | [`0xf30bace4…`](https://sepolia.uniscan.xyz/tx/0xf30bace4abab7778822e6e84baa63393a73c7d35664362acd0930fb8df4677ca) |
| `setForwarder(CRE forwarder)` (a report in between failed on an RPC race) | [`0x4af7b447…`](https://sepolia.uniscan.xyz/tx/0x4af7b447dad5bceba7e20d0db50a2b10027ac1ec981e3b9b9f8f71ef679c4cc7) |
| `setForwarder(burner)` | [`0xa88216a5…`](https://sepolia.uniscan.xyz/tx/0xa88216a5de2ba8ade95ba7b6a589816dc4780ce9e20be582e19d09655ae9edc7) |
| `onReport` fresh reference 0.998693 | [`0x4ab68b07…`](https://sepolia.uniscan.xyz/tx/0x4ab68b073018bc137b59ea5eef87b0b7f55d9f283b39e0747581ac9e5fef440f) |
| `setForwarder(CRE forwarder)` | [`0x2cbe51ec…`](https://sepolia.uniscan.xyz/tx/0x2cbe51ec760c0a9bf05182e7b011f5d91767ebc9c9108b00ec8234c27f6b0895) |

After these: forwarder `0x6E9EE680ef59ef64Aa8C7371279c27E496b5eDc1`, reference 0.998693, `maxReferenceAge` 2592000.

### All transactions

| Script | Step | Transaction |
| --- | --- | --- |
| DeployUnichainSepolia | create Aqua | [`0xf24c878d…c9be65`](https://sepolia.uniscan.xyz/tx/0xf24c878dda3538b5980da9ac7094c495ded6e0ad52b39db7dbc6a12ad5c9be65) |
| DeployUnichainSepolia | create WalletDeskRouter | [`0xf4d0c5fe…7775c3`](https://sepolia.uniscan.xyz/tx/0xf4d0c5fe59b07b75cf21bda3ef2361e3df1715815e51fc4269ae8aaecc7775c3) |
| DeployUnichainSepolia | create OverflowHook | [`0x35d069c4…bdf10b`](https://sepolia.uniscan.xyz/tx/0x35d069c4dd3efaf2777b5597ebb1ef75d5938f183222ad46d44c86d3c4bdf10b) |
| DeployUnichainSepolia | create OverflowRouter | [`0x1ade930d…c52a7c`](https://sepolia.uniscan.xyz/tx/0x1ade930d91ab63608e3b318e7c8da3c3e24b27298dd57f697930319321c52a7c) |
| DeployUnichainSepolia | create OrderBuilder | [`0xe025a62c…249fab`](https://sepolia.uniscan.xyz/tx/0xe025a62c573dbb24774e6208b7552914c5180c273379f082b54819c798249fab) |
| DeployUnichainSepolia | create DeskPriceFeed.0.8.26 | [`0x33961509…7c9f5a`](https://sepolia.uniscan.xyz/tx/0x3396150980a1106e1a6996036cb83cc0e8ac15fc04d2c62b1d4ac2ccc57c9f5a) |
| DeployUnichainSepolia | setPriceFeed(address,uint32) | [`0x62c329b5…113cd3`](https://sepolia.uniscan.xyz/tx/0x62c329b539ea69cf9801bf423d138bd20c851b42fb89b825bb19b411b9113cd3) |
| DeployUnichainSepolia | create MockERC20.0.8.26 | [`0xa850f8fd…e0d300`](https://sepolia.uniscan.xyz/tx/0xa850f8fd48a8f1d12f26a569379d78334940dd995e3cc99cf5c2414922e0d300) |
| DeployUnichainSepolia | create MockERC20.0.8.26 | [`0xe83253e5…8d3ec4`](https://sepolia.uniscan.xyz/tx/0xe83253e5546ea886533bbdc41e75e97261d2b0c1963c398347965b39608d3ec4) |
| DeployUnichainSepolia | initialize((address,address,uint24,int24,address),uint160) | [`0x32acdcb7…d7cbde`](https://sepolia.uniscan.xyz/tx/0x32acdcb7b1d8a74e50d020a3576275cde4d97b940619cf457b5dfa7801d7cbde) |
| DeployUnichainSepolia | create PoolModifyLiquidityTest | [`0x48b500a6…6c99b4`](https://sepolia.uniscan.xyz/tx/0x48b500a6bc49353e674c57599cd1223511457c05f20c49c2e562a5368f6c99b4) |
| DeployUnichainSepolia | mint(address,uint256) | [`0xa8172d50…92f481`](https://sepolia.uniscan.xyz/tx/0xa8172d5075c3b4b2b2e18859f74a2b749ef88eb3bfa4359dd94bd2fba792f481) |
| DeployUnichainSepolia | mint(address,uint256) | [`0x03cb30af…b5e1b1`](https://sepolia.uniscan.xyz/tx/0x03cb30afd366e3ea8cd136d585a34cf8f25b8a948f84468da223ede15db5e1b1) |
| DeployUnichainSepolia | approve(address,uint256) | [`0xdc6ad423…313389`](https://sepolia.uniscan.xyz/tx/0xdc6ad4239de7252a7c26a8842202964c1ba8321ad962ce90f65f771027313389) |
| DeployUnichainSepolia | approve(address,uint256) | [`0x9158015b…0f098b`](https://sepolia.uniscan.xyz/tx/0x9158015bfe93ed185c54bd735430285d4cd0b9bb951183faa0db98d50f0f098b) |
| DeployUnichainSepolia | modifyLiquidity((address,address,uint24,int24,address),(int24,int24,int256,bytes32),bytes) | [`0xfa5febdd…0a1bb0`](https://sepolia.uniscan.xyz/tx/0xfa5febdde9732d527f35d1a0c8258c49a2e1cb29835633c5a693f94eed0a1bb0) |
| DeployUnichainSepolia | modifyLiquidity((address,address,uint24,int24,address),(int24,int24,int256,bytes32),bytes) | [`0xda3fb65c…9f21c3`](https://sepolia.uniscan.xyz/tx/0xda3fb65c009df628a9cc96f46d9e9330bcaf6806b2ae788e67a6dfc0259f21c3) |
| DeployUnichainSepolia | setPoolCap((address,address,uint24,int24,address),uint256) | [`0x30ecb401…bb7b05`](https://sepolia.uniscan.xyz/tx/0x30ecb4012db81334581948b167edcfb7cb5d0bb7bf940092862c63973fbb7b05) |
| DeployUnichainSepolia | mint(address,uint256) | [`0xa32c6e5e…83f277`](https://sepolia.uniscan.xyz/tx/0xa32c6e5e52f263d05bd8751d1bbe67f828cc0260041518fccc7933f70783f277) |
| DeployUnichainSepolia | mint(address,uint256) | [`0x8f4f86fe…1f31e9`](https://sepolia.uniscan.xyz/tx/0x8f4f86fe546e1f87ded3034fd63c97e44f88d8f8b25a50d7767cccff1d1f31e9) |
| SeedLive | onReport(bytes,bytes) | [`0xfecb972a…e51909`](https://sepolia.uniscan.xyz/tx/0xfecb972a665dcb1d6ddbaf6bda19a890db51a890f52b273dcafa389d96e51909) |
| SeedLive | approve(address,uint256) | [`0x210dda26…10744e`](https://sepolia.uniscan.xyz/tx/0x210dda2637920c541f55ce9ca2824eab0ab03c51b0829962178bc346ce10744e) |
| SeedLive | approve(address,uint256) | [`0x2f28c89d…7b73d3`](https://sepolia.uniscan.xyz/tx/0x2f28c89dd1aacde1eff1272b374c9801d12b1ac47daeef600b527741d07b73d3) |
| SeedLive | ship(address,bytes,address[],uint256[]) | [`0x495fb083…824378`](https://sepolia.uniscan.xyz/tx/0x495fb08365fc9bc96679c21cfb056506d8b41c525e910c07a7f0031f02824378) |
| SeedLive | registerDesk((address,address,uint24,int24,address),(address,uint256,bytes),uint16) | [`0x780c3ddb…3c91b1`](https://sepolia.uniscan.xyz/tx/0x780c3ddbe89eee9ae751b617ed925f8d85219cac330b7a4c0f3c2aa5af3c91b1) |
| SeedLive | approve(address,uint256) | [`0x6867610f…550acc`](https://sepolia.uniscan.xyz/tx/0x6867610f67eaab3734fa450dbddba52635db28fbec3475b7ee4b5491e9550acc) |
| SeedLive | swapExactInput((address,address,uint24,int24,address),bool,uint256,uint256,address) | [`0x0c169e96…ff0340`](https://sepolia.uniscan.xyz/tx/0x0c169e96abd27278b2330755717034dc30bc5d7eed5be48dbc48dbc43bff0340) |
| SeedLive | create PoolSwapTest | [`0xcede9c75…aa07e7`](https://sepolia.uniscan.xyz/tx/0xcede9c75afd49e04b3ae70749691802d0e78173536f56b5511b0dc1c3eaa07e7) |
| SeedLive | approve(address,uint256) | [`0x9c6af03b…048f7a`](https://sepolia.uniscan.xyz/tx/0x9c6af03bdbc152129be4b8489e18c8269aa46ca825efeda4b829433608048f7a) |
| SeedLive | swap((address,address,uint24,int24,address),(bool,int256,uint160),(bool,bool),bytes) | [`0x8d2b81fe…305d6e`](https://sepolia.uniscan.xyz/tx/0x8d2b81fe61e8d7f5ea1187e32b6d8ad81904df3b3de595556a7809286f305d6e) |

