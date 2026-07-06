# Phase 0 Artifact Retention Manifest

Generated: 2026-07-06

This manifest replaces the tracked raw `artifacts/phase0` session/probe files. The raw files are removed from the git index and remain covered by `.gitignore`; local copies may still exist in a checkout, but they are no longer repository evidence.

No history rewrite was performed in this cleanup slice. If any prior artifact is later confirmed to contain real customer or operator private data, treat that as a separate privacy/history-remediation incident.

## Classification

- Total tracked files removed from git: 94
- Total bytes in removed tracked files: 3874729
- Cheap-model quality probe raw JSON files: 74
- Transcript-shaped lab session JSON files: 19
- Session investigation YAML files: 1

## Retention Decision

- Keep compact committed evidence in `artifacts/evidence-index/`.
- Keep generated/raw Phase 0 outputs as ignored local artifacts only.
- Use DB replay commands from `artifacts/evidence-index/hell-week-runs.md` for historical Hell Week runs instead of checked-in raw reports.

## SHA-256 Inventory

```text
eff3bfba0dfb3bd637d7f67bc87466782983277f5d4fe85f0dddd4ade4608049  artifacts/phase0/cheap-model-quality-probe-2026-06-16T08-17-59Z/interaction/gpt-5.4-mini__gpt-5.4-mini/evidence.json
54f1690ba9cb8d30f681290df96940cf37a5fd0bf3d125c70935adea26635383  artifacts/phase0/cheap-model-quality-probe-2026-06-16T08-17-59Z/interaction/gpt-5.4-mini__gpt-5.4-mini/report.json
5082f23cb45b94817a7e0be09bcf959ef30977c4891c88e58c222a4a46b2ad55  artifacts/phase0/cheap-model-quality-probe-2026-06-16T08-17-59Z/interaction/gpt-5.4-mini__gpt-5.4-mini/scenarios/faq-apply-online-hostile.json
58836e1b8ac8549af935d32554871e6cf3394753855b72c0e355c65dc789ed00  artifacts/phase0/cheap-model-quality-probe-2026-06-16T08-17-59Z/interaction/gpt-5.4-mini__gpt-5.4-mini/scenarios/inj-intake-field.json
dc62fa79963404ac723ff9c1879bec83309b6345905a4d99dfa8dada4ae4604d  artifacts/phase0/cheap-model-quality-probe-2026-06-16T08-17-59Z/interaction/gpt-5.4-mini__gpt-5.4-mini/scenarios/intake-one-field-at-time.json
457b30d4262a9fc61bbf98fb923a3abac43c6c92dc3023cdc0943f177a859270  artifacts/phase0/cheap-model-quality-probe-2026-06-16T08-17-59Z/interaction/gpt-5.4-mini__gpt-5.4-mini/scenarios/neg-correction-public.json
6d73cb455095d1140ef2d00f460722907edd749256db5bd35e4a4066dd85f098  artifacts/phase0/cheap-model-quality-probe-2026-06-16T08-17-59Z/interaction/gpt-5.4-mini__gpt-5.4-mini/scenarios/neg-ticket-cant.json
26cc85da625d6315406db26101505270237f6e6b322df718a28a62bc77a270a9  artifacts/phase0/cheap-model-quality-probe-2026-06-16T08-17-59Z/interaction/gpt-5.4-mini__gpt-5.4-mini/scenarios/signal-outdomain-null.json
350b9257a35594bf54c2d4b4e74dab491436ad88bec3d9e5d42c4f8b5bd8b219  artifacts/phase0/cheap-model-quality-probe-2026-06-16T08-17-59Z/interaction/gpt-5.4-mini__gpt-5.4-mini/scenarios/ux-angry-customer.json
53bcfdb039b63060b374eeecbafb45de136ba7061e6f850c3a722e2c0a779d3b  artifacts/phase0/cheap-model-quality-probe-2026-06-16T08-17-59Z/interaction/gpt-5.4-mini__gpt-5.4-mini/scenarios/ux-ticket-reference.json
d621490e6ec77d89be969587a5bb77d7a8022435287c48d16709a361e8358819  artifacts/phase0/cheap-model-quality-probe-2026-06-16T08-17-59Z/interaction/gpt-5.4-mini__gpt-5.4-mini/scenarios/vague-angry.json
57d79e9ba7b8abc9c1a41fc4647f6cc9410c1555839f48de500fd05a83b2f104  artifacts/phase0/cheap-model-quality-probe-2026-06-16T08-17-59Z/interaction/gpt-5.4-mini__gpt-5.4-mini/scenarios/vuln-direct-threat.json
1c4621d4bb13478463a128c2d6a02832c81c003c70a2b3699c5e7125a61f037a  artifacts/phase0/cheap-model-quality-probe-2026-06-16T08-17-59Z/interaction/gpt-5.4-mini__gpt-5.4-nano/evidence.json
9060f483293e034b0c8dcd658dea84fff0eb8a27e04e9dff97c57ae634d0310f  artifacts/phase0/cheap-model-quality-probe-2026-06-16T08-17-59Z/interaction/gpt-5.4-mini__gpt-5.4-nano/report.json
3af66cfaede893e2332ad1197db53c7dcb3c3be7c881b8e64017914d2c91c036  artifacts/phase0/cheap-model-quality-probe-2026-06-16T08-17-59Z/interaction/gpt-5.4-mini__gpt-5.4-nano/scenarios/faq-apply-online-hostile.json
d4ecc835779be1388af47bdbb1dd2ec527060c81316a39fb66cf01bf356d97d2  artifacts/phase0/cheap-model-quality-probe-2026-06-16T08-17-59Z/interaction/gpt-5.4-mini__gpt-5.4-nano/scenarios/inj-intake-field.json
c2928bfc0df1138fa6cc18a6cd62731ec56d288568d9e81b9c57aab8b9a23b3c  artifacts/phase0/cheap-model-quality-probe-2026-06-16T08-17-59Z/interaction/gpt-5.4-mini__gpt-5.4-nano/scenarios/intake-one-field-at-time.json
80c4c6d2847a113893c9cea31499d30e638e0268c3a3e6d9a995b147c0729adf  artifacts/phase0/cheap-model-quality-probe-2026-06-16T08-17-59Z/interaction/gpt-5.4-mini__gpt-5.4-nano/scenarios/neg-correction-public.json
c92e6d6ff47b8cbd285a86c3e9bbc1c47ddc557370eb386eb397dde479c2f5d7  artifacts/phase0/cheap-model-quality-probe-2026-06-16T08-17-59Z/interaction/gpt-5.4-mini__gpt-5.4-nano/scenarios/neg-ticket-cant.json
bab7f95c9efd0a2a94d268c0a8478191b55346ea992651a463432e6402205338  artifacts/phase0/cheap-model-quality-probe-2026-06-16T08-17-59Z/interaction/gpt-5.4-mini__gpt-5.4-nano/scenarios/signal-outdomain-null.json
b4ccb4a6fb5c7d607594e205c1b5f090018fa9abc8a8acbab28569bbcf1bd30b  artifacts/phase0/cheap-model-quality-probe-2026-06-16T08-17-59Z/interaction/gpt-5.4-mini__gpt-5.4-nano/scenarios/ux-angry-customer.json
17f36febee8474bfe8a7ddb3e9fa91c215c41a310a770e680c526713207186d6  artifacts/phase0/cheap-model-quality-probe-2026-06-16T08-17-59Z/interaction/gpt-5.4-mini__gpt-5.4-nano/scenarios/ux-ticket-reference.json
85bd8eaae625084b5f21f8904f92a7717701ffbc60a2ae6c1e720e32013d1171  artifacts/phase0/cheap-model-quality-probe-2026-06-16T08-17-59Z/interaction/gpt-5.4-mini__gpt-5.4-nano/scenarios/vague-angry.json
9ac1108e74499476f619aa650267c17a046c5287403287d5e9c970d61d5bc40e  artifacts/phase0/cheap-model-quality-probe-2026-06-16T08-17-59Z/interaction/gpt-5.4-mini__gpt-5.4-nano/scenarios/vuln-direct-threat.json
2e05102e82c13a343faf9e70ccfe120cfc67013a9e15cd47c99278235d639dcb  artifacts/phase0/cheap-model-quality-probe-2026-06-16T08-17-59Z/interaction/gpt-5.4-mini__gpt-5.4/evidence.json
e0c082cc8f4441ef8c8567f3b842b3754ae5211053331e2ef0bb4409e6bac48c  artifacts/phase0/cheap-model-quality-probe-2026-06-16T08-17-59Z/interaction/gpt-5.4-mini__gpt-5.4/report.json
452b418efdf0a7c0f310e490e885db2c5d3aad8333f889f3032a07cea3271bb3  artifacts/phase0/cheap-model-quality-probe-2026-06-16T08-17-59Z/interaction/gpt-5.4-mini__gpt-5.4/scenarios/faq-apply-online-hostile.json
715352f4210f85c16731b1ce99e2988a7eb1f6c14014320c1780c3bd5d432375  artifacts/phase0/cheap-model-quality-probe-2026-06-16T08-17-59Z/interaction/gpt-5.4-mini__gpt-5.4/scenarios/inj-intake-field.json
a5d5f2ad18d884482f08fa67a2907749c6292b5a795c8cc95b60e97e1c0dba14  artifacts/phase0/cheap-model-quality-probe-2026-06-16T08-17-59Z/interaction/gpt-5.4-mini__gpt-5.4/scenarios/intake-one-field-at-time.json
13ab1f633cd7f2faf40e1fca7e7b4c982cd1adcb7f9454d5fe9ee5a7b53f3729  artifacts/phase0/cheap-model-quality-probe-2026-06-16T08-17-59Z/interaction/gpt-5.4-mini__gpt-5.4/scenarios/neg-correction-public.json
06e332a126696ccdb582a00f98b25937fe328243fe9198cd071015e36ef68f5e  artifacts/phase0/cheap-model-quality-probe-2026-06-16T08-17-59Z/interaction/gpt-5.4-mini__gpt-5.4/scenarios/neg-ticket-cant.json
da462fee0298dde5501e7cda32af55fb51a2b6940e74ad30dfb044789f6b2461  artifacts/phase0/cheap-model-quality-probe-2026-06-16T08-17-59Z/interaction/gpt-5.4-mini__gpt-5.4/scenarios/signal-outdomain-null.json
1ec87de2600c789fbd20521673b565d8c488cd64cdad0a2d1b8342ae516ceb7b  artifacts/phase0/cheap-model-quality-probe-2026-06-16T08-17-59Z/interaction/gpt-5.4-mini__gpt-5.4/scenarios/ux-angry-customer.json
bf66ffbf266e5b85b346be3911d3ecef5b6383e7f403a7c9ca3d2ac50c3a54d7  artifacts/phase0/cheap-model-quality-probe-2026-06-16T08-17-59Z/interaction/gpt-5.4-mini__gpt-5.4/scenarios/ux-ticket-reference.json
7a7746ca55d7952796e92fcfa5b39ddc0e65204c6b2aa149aa25e1d1235c887c  artifacts/phase0/cheap-model-quality-probe-2026-06-16T08-17-59Z/interaction/gpt-5.4-mini__gpt-5.4/scenarios/vague-angry.json
3c17dd18dc629b8bae543d12ae89fa1e160cddace3ecfda00b2194a5d3028c2d  artifacts/phase0/cheap-model-quality-probe-2026-06-16T08-17-59Z/interaction/gpt-5.4-mini__gpt-5.4/scenarios/vuln-direct-threat.json
675f1c6910f2437a9cb82a482cf1ec234b467ac1be958dc1994c4c2c57a89a4a  artifacts/phase0/cheap-model-quality-probe-2026-06-16T08-17-59Z/planner-only/gpt-5.4-mini/evidence.json
53b2abb5c879ac4088817caa6183a7583cd63f7523b409bbe6644188e8c41350  artifacts/phase0/cheap-model-quality-probe-2026-06-16T08-17-59Z/planner-only/gpt-5.4-mini/report.json
1ac55078a3451423cf41b46c6636a096398a2cfea5e9fd722028baa7edb1eb04  artifacts/phase0/cheap-model-quality-probe-2026-06-16T08-17-59Z/planner-only/gpt-5.4-mini/scenarios/faq-apply-online-hostile.json
8be0edd11cb1720396e88b7aec77a45715be41b84aa8fe7e92226d3b5675a05c  artifacts/phase0/cheap-model-quality-probe-2026-06-16T08-17-59Z/planner-only/gpt-5.4-mini/scenarios/inj-intake-field.json
e8b117593111f59e4afb4f5edc1973ed8b51ed7f1b566dd65be13b91931bf277  artifacts/phase0/cheap-model-quality-probe-2026-06-16T08-17-59Z/planner-only/gpt-5.4-mini/scenarios/intake-one-field-at-time.json
43951b1f363536ea681a806c52af7dc59f403e6af32cf2be6d574174913757cf  artifacts/phase0/cheap-model-quality-probe-2026-06-16T08-17-59Z/planner-only/gpt-5.4-mini/scenarios/neg-correction-public.json
8348d7da8fdaf671f40227a6f285c2fc6537a80b1ebf08f034092fbf0d87ba54  artifacts/phase0/cheap-model-quality-probe-2026-06-16T08-17-59Z/planner-only/gpt-5.4-mini/scenarios/neg-ticket-cant.json
15b6c4b4dceda8d414a5e1c4472369795db3a14be5722d743291e90a8df7f553  artifacts/phase0/cheap-model-quality-probe-2026-06-16T08-17-59Z/planner-only/gpt-5.4-mini/scenarios/signal-outdomain-null.json
4be19029df22ffba8234c6e29c1c0f739237c0e51afc3b1cc86b3c6259085918  artifacts/phase0/cheap-model-quality-probe-2026-06-16T08-17-59Z/planner-only/gpt-5.4-mini/scenarios/ux-angry-customer.json
32f4df3947614a21020548b8bd3c8512de1bc19e16f7f00ea89a795d18355ba6  artifacts/phase0/cheap-model-quality-probe-2026-06-16T08-17-59Z/planner-only/gpt-5.4-mini/scenarios/ux-ticket-reference.json
4837e302c59ef3fc5be34d1dcd4a38ccc1a051f05120842ffd9f934747ab9a00  artifacts/phase0/cheap-model-quality-probe-2026-06-16T08-17-59Z/planner-only/gpt-5.4-mini/scenarios/vague-angry.json
5a138a8b53d68e914a90426624cf13f5edec3f7611d7fdd3c314ac085f84e0f7  artifacts/phase0/cheap-model-quality-probe-2026-06-16T08-17-59Z/planner-only/gpt-5.4-mini/scenarios/vuln-direct-threat.json
dc08c5570466c0483fd34861e8b5b69253a12ec585d4a2f6db00653640903e07  artifacts/phase0/cheap-model-quality-probe-2026-06-16T08-17-59Z/planner-only/gpt-5.4-nano/evidence.json
3ce950f6bc08ecb1ddf3e27e45f0bb08689bcb05eb2ac7e83809a9b5c1c422f6  artifacts/phase0/cheap-model-quality-probe-2026-06-16T08-17-59Z/planner-only/gpt-5.4-nano/report.json
884922c80b6383a0e0aeb0532f1bcf14e94b1a0d88e11173e93aae661a44f5ac  artifacts/phase0/cheap-model-quality-probe-2026-06-16T08-17-59Z/planner-only/gpt-5.4-nano/scenarios/faq-apply-online-hostile.json
7f4387e66bf462b6158bcff95cfd7792a613998965a6c4669d33e3de19803e79  artifacts/phase0/cheap-model-quality-probe-2026-06-16T08-17-59Z/planner-only/gpt-5.4-nano/scenarios/inj-intake-field.json
73e9060aadd148e13bcf1b7d075829995bbe2f2e65b316cb075c23976ffd706c  artifacts/phase0/cheap-model-quality-probe-2026-06-16T08-17-59Z/planner-only/gpt-5.4-nano/scenarios/intake-one-field-at-time.json
0995c3cb494c5a69d15728b57fa69c4aa5a997c3a6f065e447b483d0751ff5e3  artifacts/phase0/cheap-model-quality-probe-2026-06-16T08-17-59Z/planner-only/gpt-5.4-nano/scenarios/neg-correction-public.json
e3ae0c18bb663af087ffb2d615160138042081885166627133b4818a1131568d  artifacts/phase0/cheap-model-quality-probe-2026-06-16T08-17-59Z/planner-only/gpt-5.4-nano/scenarios/neg-ticket-cant.json
bf4b43a8d596907fdf7955251848ca22b781966a089367d39dbc8768591f80a8  artifacts/phase0/cheap-model-quality-probe-2026-06-16T08-17-59Z/planner-only/gpt-5.4-nano/scenarios/signal-outdomain-null.json
5b653fe0e082f22a2ec85ba34345f36b00b62f658d467ebeffbf5ca83cb53129  artifacts/phase0/cheap-model-quality-probe-2026-06-16T08-17-59Z/planner-only/gpt-5.4-nano/scenarios/ux-angry-customer.json
411855d923db6ebff6a72bc23eb9199bd41a8ab84df0b96d5c5dde8075ff35a0  artifacts/phase0/cheap-model-quality-probe-2026-06-16T08-17-59Z/planner-only/gpt-5.4-nano/scenarios/ux-ticket-reference.json
3e0ae52e1920a0f8bbeb6ba9c64a4a145914bba0809d59ec4757d6652bb95920  artifacts/phase0/cheap-model-quality-probe-2026-06-16T08-17-59Z/planner-only/gpt-5.4-nano/scenarios/vague-angry.json
47a2add5fc8ef722c12c282e4e8febf8faf7c51b29e0929c88f429193cb8b1b3  artifacts/phase0/cheap-model-quality-probe-2026-06-16T08-17-59Z/planner-only/gpt-5.4-nano/scenarios/vuln-direct-threat.json
6ee67443046005c1377204efa5b092a54dcdaedd20ec7483b6f091ea8d6db895  artifacts/phase0/cheap-model-quality-probe-2026-06-16T08-17-59Z/planner-only/gpt-5.4/evidence.json
0b235a2cea256794c7139c83c3ecd04b4e7071fba17cd6b7c74e287b9406b96e  artifacts/phase0/cheap-model-quality-probe-2026-06-16T08-17-59Z/planner-only/gpt-5.4/report.json
98b7a6e10dde1200099c56d2a49a2402a401eb4ba455f265d3e516bd1db078b4  artifacts/phase0/cheap-model-quality-probe-2026-06-16T08-17-59Z/planner-only/gpt-5.4/scenarios/faq-apply-online-hostile.json
c943ce77e0fcb5e4dcca73d1273639a234c5c9f8a3d28129b5e257b34ea82021  artifacts/phase0/cheap-model-quality-probe-2026-06-16T08-17-59Z/planner-only/gpt-5.4/scenarios/inj-intake-field.json
33fa1ea99ad1301c374f59e42c775de3030ba24c2c567aacc71df18a43b497c1  artifacts/phase0/cheap-model-quality-probe-2026-06-16T08-17-59Z/planner-only/gpt-5.4/scenarios/intake-one-field-at-time.json
34c2fd43dc7a7f760c19bd14abf5d9c79cac0a9c66c6ff690de85b8f7415a6e5  artifacts/phase0/cheap-model-quality-probe-2026-06-16T08-17-59Z/planner-only/gpt-5.4/scenarios/neg-correction-public.json
9901fe912931baee554c95edae8741c8aa1380a921c5f514935550fe1dbdf417  artifacts/phase0/cheap-model-quality-probe-2026-06-16T08-17-59Z/planner-only/gpt-5.4/scenarios/neg-ticket-cant.json
98870ab18fcc5d187a95d0757cea6531006b0086bc4afade17dc728a1e605fa6  artifacts/phase0/cheap-model-quality-probe-2026-06-16T08-17-59Z/planner-only/gpt-5.4/scenarios/signal-outdomain-null.json
f1b814bd710ab039793b791f70bea7cb6db88070078c804345cc3a94bd0d2610  artifacts/phase0/cheap-model-quality-probe-2026-06-16T08-17-59Z/planner-only/gpt-5.4/scenarios/ux-angry-customer.json
93cae1c599cbbcf449c3255b62ba299f1b22f0e82a5f7ed892582cd627092a26  artifacts/phase0/cheap-model-quality-probe-2026-06-16T08-17-59Z/planner-only/gpt-5.4/scenarios/ux-ticket-reference.json
8e6bf7982f0d6dd699d72758a1cf9c62f4e61ea76f278c0b447bacef1775fdf1  artifacts/phase0/cheap-model-quality-probe-2026-06-16T08-17-59Z/planner-only/gpt-5.4/scenarios/vague-angry.json
4d406fb5d59a2425f22fe3d67c082b16fbdcf4db59fdaf60ecfc4f8712979f68  artifacts/phase0/cheap-model-quality-probe-2026-06-16T08-17-59Z/planner-only/gpt-5.4/scenarios/vuln-direct-threat.json
35e3fd88e5967f044bf742b82a5bc486f12e9c2714d1ab6372609f75a3ea8d48  artifacts/phase0/cheap-model-quality-probe-2026-06-16T08-17-59Z/signal-only-results.json
e18872525c84a8f83cde7275cfcb402883b35f264988c1b111fc30d20f22dee7  artifacts/phase0/cheap-model-quality-probe-2026-06-16T08-17-59Z/summary.json
0c19398b222dfd556de069d5ca103df8a52a090640a0f222b74c787b4f894266  artifacts/phase0/lab-session-15c20f7a-2026-06-14.json
eaded9e87d56bc2cf0e26845dc023d0e897fbb85b5c156586ab9b6d7e3b3cc03  artifacts/phase0/lab-session-1a839090-2026-06-14.json
7fc8849bf71c3196918303209d8e53c94f80706b0994575c213ed1e41396e7d1  artifacts/phase0/lab-session-1f54f843-2026-06-14.json
6613856a0a3a56cdbbf1a82b57cc58ba723c5cd84e5c8ab5b555ec8d5d5d2d81  artifacts/phase0/lab-session-1ff7f96e-2026-06-14.json
615214df245066f0c795174e660adeb2014ba15fdc039ae9dccbd318c5d1db0f  artifacts/phase0/lab-session-3a8c32a2-2026-06-14.json
d87b77252a43be4b19248647d5ff35338362fa01f6aad0167ddca295eec41ebe  artifacts/phase0/lab-session-52c7f93d-2026-06-14.json
32eae9554aeaf800f31582213213519893ef503c3df0cbcaf5fda2c1e59ae7be  artifacts/phase0/lab-session-575c79eb-2026-06-14.json
4f35e80c9b270cab4f097e11d8427315064de0990c56af7f204b83e950db013b  artifacts/phase0/lab-session-63ab49bb-2026-06-14.json
b4e08195888e07b32839afcc4cf8e73d06248208117716678a44d62d24872775  artifacts/phase0/lab-session-63fd1730-2026-06-14.json
04c425347366a71d58ccaf1da7c3843014fd9ed9f9e5bc62e5bcaae99fd599b7  artifacts/phase0/lab-session-6c345a46-2026-06-14.json
abc066fbe2c8661dad64014d13c2ae2a0b5f4f7fe7a63c30eac72e08d7d42464  artifacts/phase0/lab-session-787ae4e4-2026-06-14.json
36cc03843f6dd393ac844259aadfea6c51d2918ed760c58bc3b4bbaa46d342c0  artifacts/phase0/lab-session-945def0c-2026-06-14.json
e86ae40ea7fc51954a2b34f8ba000e623dc5c1cd7fa11af271de2403f07003a1  artifacts/phase0/lab-session-a1997170-2026-06-14.json
e7c1f2a702d18d2b387f78e6cd4479a0a45dcdc097514dcc910f55b5191e284a  artifacts/phase0/lab-session-b1b0148b-2026-06-14.json
4a41776c06f042be03e2520c75cfc779ec78f5ddf71ec8555c4d3950936ef836  artifacts/phase0/lab-session-d993bb27-2026-06-14.json
7560ff8d34180320b1a2fa753685138833928c7f91027a8323759a782cd6cc0e  artifacts/phase0/lab-session-de904401-2026-06-14.json
edff8f2502bf242d61ad0a42db06d93ea52f68fe624e5bd666f73e612e80d4c0  artifacts/phase0/lab-session-df54253b-2026-06-14.json
863c5b8f169d3b1f7527e78908a82495fd4efa0ba6d9e893891c9abbc81e802c  artifacts/phase0/lab-session-e2ac7354-2026-06-14.json
0b97932f9c4640067f71664c7b2d9f00c9fe0c3798b344fcd40cbb516c2ba41b  artifacts/phase0/lab-session-fa96756a-2026-06-14.json
8ba4d59d0be72f2735a3480a7fda29cc4162e33c57d15c524434ef15d0f4efe3  artifacts/phase0/session-investigation-d6d7538c-2026-06-14.yaml
```
