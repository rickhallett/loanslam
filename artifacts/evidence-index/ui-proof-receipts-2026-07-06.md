# UI Proof Receipt Retention - 2026-07-06

This index replaces tracked PNG proof receipts under `artifacts/`. The PNG files
were removed from the git index and are local-only under the existing
`artifacts/*` ignore rule. Keep durable proof summaries in Markdown/JSON; when a
visual receipt is needed, regenerate it from the named proof command or retain it
outside git.

`site/public/*.png` files are application assets, not proof receipts, and remain
tracked.

## Demo Concierge

| SHA-256 | Bytes | Previous path |
| --- | ---: | --- |
| `f4d9e274a8dacdd255575654a0692638f8e38c5cdc7e6912fd42f9ab7d0acca1` | 104743 | `artifacts/demo-concierge/chat-parity-dc002/closed-astro.png` |
| `1d3637a50250675d273215e9492328ea1a91688479b149e54043816be9b6b44d` | 81272 | `artifacts/demo-concierge/chat-parity-dc002/closed-diff.png` |
| `4da9c68a02f770d9a4c0b1f4f21955baf2d92f501de826e76352204daffd62c7` | 104819 | `artifacts/demo-concierge/chat-parity-dc002/closed-nuxt.png` |
| `d5a13c37a1163fe1decd091b22bfc4650d7a62ae384a179b7707e3aa0f21e2b7` | 174374 | `artifacts/demo-concierge/chat-parity-dc002/open-astro.png` |
| `c891f88fba608117aadab79e4bfbb8f96f78f6dce84e5a656da789aadc2bf934` | 69713 | `artifacts/demo-concierge/chat-parity-dc002/open-diff.png` |
| `82cb913893f08493604818cca7256052fa8f9df6387d931782e803028981f15c` | 172233 | `artifacts/demo-concierge/chat-parity-dc002/open-nuxt.png` |
| `d3ee95d0f9ea424b490e837d862474351b67c564c54b2bb99fe3380e485e113a` | 317577 | `artifacts/demo-concierge/dc002-surface/apply-panel-open.png` |
| `5fd20433d5fd5d11cd432f31f9a78cf13442fde99ec617e7696ffc8d0cd83441` | 239409 | `artifacts/demo-concierge/dc003-navigate/apply-after-nav.png` |
| `0623d20a403afa845ac7dccea279fd5d9ef2309280e20e7295f29f989d917612` | 260713 | `artifacts/demo-concierge/dc005-form-state/apply-form-awareness.png` |
| `04e4f6149df604e7f4156e2df860e112485e8803317d4369089f3d34d73ad4b1` | 254504 | `artifacts/demo-concierge/dc006-handoff/apply-handoff-complete.png` |
| `9503ccf1685564c11db82f17502f2ce24ee27930dc332c72c75f984153632d5a` | 237106 | `artifacts/demo-concierge/dc006-handoff/apply-handoff-intake.png` |
| `bfd5cc856ea76e14f39d313649ccedc4c2b2744be98bb620d21bfb4865990fd7` | 382827 | `artifacts/demo-concierge/dc2-001-presence/home-panel-open.png` |
| `f271da9d3539da7d5604ca4d867de23c96a5fd49194a378545e86d0fb3f6f7e0` | 201712 | `artifacts/demo-concierge/dc2-002-page-context/instalment-page-aware.png` |
| `7c3c24f19b9a3778a3aea48e808f4f32fc7105e9c52149ba8f493cfeb03bf2c5` | 231557 | `artifacts/demo-concierge/dc2-003-persistence/restored-after-reload.png` |
| `10ac36738c9e5d79ba29dd279871fcc40d7074900192a5dbe4982468e091b31c` | 221248 | `artifacts/demo-concierge/dc2-004-live-page-context/instalment-page-aware.png` |
| `459992c9d1fbd66a403980d3ddd65df1211a0fad5f8c43e290e6813440293086` | 229729 | `artifacts/demo-concierge/dc2-004-live-persistence/restored-after-reload.png` |
| `cb5bb8ba0f20272acd9c93d139a5bbe839d0630177b6d09f9174540526c16c4a` | 218166 | `artifacts/demo-concierge/frost-scope/faq-open-unfrosted.png` |
| `0bf87e69a2a4c6d723cec0aaaa6569288e66d1b8e99acdd9f7d2a83bacb20bb2` | 213983 | `artifacts/demo-concierge/rehearsal-local-dc2/beat1-offer.png` |
| `c9a1451bfd0af1d93f6fabd2a6cd92e7918799d0eae3d04b9a27fe2962b90317` | 256655 | `artifacts/demo-concierge/rehearsal-local-dc2/beat2-arrival.png` |
| `4972bf56729fd29fe6ff7c45426a272cb708b115cd22b2f1d70029806bb0e840` | 254263 | `artifacts/demo-concierge/rehearsal-local-dc2/beat3-form-aware.png` |
| `3185057013e2fd738f21c8f383860370fa55a6e5439f34219eb67cec7fc329d7` | 252239 | `artifacts/demo-concierge/rehearsal-local-dc2/beat4-handoff-complete.png` |
| `9d1f9d8f27628a864ec290b3a34b01e5bb558e9fceee183752a34e268c306f00` | 216211 | `artifacts/demo-concierge/rehearsal/beat1-offer.png` |
| `fb9b4f7ee38f66763086e0f0167efa50a1247793103bee052d9716379f3d41a8` | 287250 | `artifacts/demo-concierge/rehearsal/beat2-arrival.png` |
| `ef129298495c8ee37f512ca0e9f0da30b2c3ae9a5a3a8193fb9d33a29cffed4b` | 241078 | `artifacts/demo-concierge/rehearsal/beat3-form-aware.png` |
| `0e83df7f7853231bff720e37c9c84e84eb1a87ffad6586b9df7fa5ed1b8ab462` | 244188 | `artifacts/demo-concierge/rehearsal/beat4-handoff-complete.png` |

## Demo Resilience

| SHA-256 | Bytes | Previous path |
| --- | ---: | --- |
| `32b7f2a9e75a62ea6fbd75248d3f2a1f618e26589a51f41c5163c5e09b9fe046` | 184143 | `artifacts/demo-resilience/dr001-resurrection/resurrected.png` |
| `3d0650b187a71dd579807b15129d9ac80b1bcef8c1f17e761de099183ed46fb5` | 199269 | `artifacts/demo-resilience/dr002-streaming/final.png` |
| `292e41eb9a176bf0c9c52e9969a9ecf9d525f71f0c19e5cdf7fa8f4907bee7d9` | 152479 | `artifacts/demo-resilience/dr002-streaming/mid-stream.png` |
| `463496fa2787852a93168a54785f6b1d78a57ab51ac76fbc43c2ee3bffb2c0ae` | 179528 | `artifacts/demo-resilience/dr003-live-restart/recovered-after-redeploy.png` |

## Integrated POC

| SHA-256 | Bytes | Previous path |
| --- | ---: | --- |
| `c5a8c6bee8166cd52638451fa5cd0ccf55ad6fb853dd572139aa42454bb99ce4` | 115362 | `artifacts/integrated-poc/ipoc-account-answers-01-browser.png` |
| `9bb05eea134f9fe73cd547ff2c16f8482a296a40942f100f3f7905a8e29ff406` | 245716 | `artifacts/integrated-poc/ipoc-admin-workflow-01-browser.png` |
| `06f06e72f694d6432be3e4467467848c2ca6df5ba2ae143c3c96fe40833592c4` | 75981 | `artifacts/integrated-poc/ipoc-customer-lookup-01-browser.png` |
| `4eabe4d03ca30c375b962056c4f598a62ce6fea96d1c5810b06eb9d705a04fd7` | 243784 | `artifacts/integrated-poc/ipoc-deploy-live-01-browser.png` |
| `4bd19a4ff931de559c64d3fa08fcc5b0fe360cd95e3f8d73eb098d94c9e5a5ca` | 107843 | `artifacts/integrated-poc/ipoc-golden-path-01-browser.png` |
| `e072a31095d3339e855f7ae9bad9fd6d7e0cbc918e0d7f9fba4440317c1413b0` | 159510 | `artifacts/integrated-poc/ipoc-handoff-capture-01-browser.png` |

## Site Nuxt

| SHA-256 | Bytes | Previous path |
| --- | ---: | --- |
| `3687228d7732d410bf51e04ac919d3677fd587662a509412f363d15de4261376` | 174865 | `artifacts/site-nuxt/chat-parity-sn008/open-astro.png` |
| `82cb913893f08493604818cca7256052fa8f9df6387d931782e803028981f15c` | 172233 | `artifacts/site-nuxt/chat-parity-sn008/open-nuxt.png` |
| `3e8c71ccab154fa4ec444448e0eab027a36d4aa7980d05f38fabdcca96e2b7df` | 137453 | `artifacts/site-nuxt/site-nuxt-apply-01-interactive.png` |
| `8c65d58fef7d86e1dcfb7862f72a89a296eb8fe12d7f7dee6a53a9c2f7b22093` | 219378 | `artifacts/site-nuxt/sitenuxt-chat-deploy-01-browser.png` |
| `1535d55ff63e7e6c6bf6668b72f58076da13697bd02a3ef7751eeda6ff3f479d` | 151073 | `artifacts/site-nuxt/sitenuxt-chat-devtools-01-browser.png` |
| `8dc710f07d9927591c1ca8e740ad6cb13c26cf5e7f4ef94ba911cbaecf925f5b` | 154184 | `artifacts/site-nuxt/sitenuxt-chat-devtools-01-live.png` |
| `417bd431151876c863f10bcd2f4e48abbeb587899fddf867330381ffed079998` | 207918 | `artifacts/site-nuxt/sitenuxt-chat-panel-01-browser-intake.png` |
| `eb85967ed9339d7198aba69e9ea66842d89fe9cf8fd58930452d5533a136cc20` | 207736 | `artifacts/site-nuxt/sitenuxt-chat-panel-01-browser.png` |
| `f714bcdd2b0113c5f14cd0e220283bb5a3132a30407a18fa19009d1d231ff8c9` | 108632 | `artifacts/site-nuxt/sitenuxt-contact-context-01-browser.png` |
| `9611d1890a15faac350e7769f34fc3efb087b55aa442cd8ff58ac705102314fd` | 109947 | `artifacts/site-nuxt/sitenuxt-contact-context-01-live.png` |
