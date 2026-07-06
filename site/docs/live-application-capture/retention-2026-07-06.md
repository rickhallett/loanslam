# Live Application Capture Retention Manifest

Generated: 2026-07-06

This manifest replaces tracked raw production-source captures and screenshot receipts under `site/docs/live-application-capture/`. The local files are removed from the git index and ignored; the committed reference is the route map plus structured DOM extracts that do not preserve downloaded source files.

No history rewrite was performed. If a removed capture later needs privacy handling beyond normal retention cleanup, treat that as a separate remediation incident.

## Classification

- Total tracked files removed from git: 34
- Total bytes in removed tracked files: 4318977
- Downloaded HTML/JS source captures: 21
- Screenshot receipts: 13

## Retention Decision

- Keep `README.md` as the human route/capture index.
- Keep `dom/*.dom.json` and `dom/*.snapshot.txt` as structured route/copy/field extracts for local prototype work.
- Keep raw downloaded source and screenshot receipts only as ignored local artifacts when needed.

## SHA-256 Inventory

```text
5f3dba9955d83c4b1622d2d384f93005182b82721b4fbe31198146bded556c76  site/docs/live-application-capture/screenshots/application-declined.png
124136613f642253e457fd7e4c4a0f98e165f86ddb4ffcc84bcbbb77e618b195  site/docs/live-application-capture/screenshots/local-apply-final.png
217f5954eac868d9fb7bc541dcc5ca64df5c2cc6519bb0323606e78c48523937  site/docs/live-application-capture/screenshots/local-apply-mobile-start.png
78c13f2622a3f92ff2e846823ae3e6d51c54f4bffaeffafa0ef0c09050b10406  site/docs/live-application-capture/screenshots/local-apply-start.png
e5443ba92c26b9fcaedc64b0e274d2127df6572fdc9a4ffbd1c6e0613fbc1571  site/docs/live-application-capture/screenshots/step-01-after-address-lookup.png
eff529ee148150dc3a642627c00d97c0b118810ba21dbd96fb397bfb330575e1  site/docs/live-application-capture/screenshots/step-01.png
c50a28806bb10ac0a1d7d55fac8162707d5c096e0e6ee44ad198236de737529c  site/docs/live-application-capture/screenshots/step-02.png
82f000762abc0d41abbf2a6ec8e44b2e96e8bc33ad840bbe25e023bb17e56692  site/docs/live-application-capture/screenshots/step-03.png
bc4554656b46845a4ab841dc572fa113b5ca34c75ffe00433ea04bd99c198f19  site/docs/live-application-capture/screenshots/step-04.png
f7d9424611e6366271d4fd3700186dd78b8149fc96386a020ef9c5766a722c80  site/docs/live-application-capture/screenshots/step-06.png
16fa152729cfe87076c489ae691bc1aad9ee4378664feec8eba5d546da934569  site/docs/live-application-capture/screenshots/step-07-revealed.png
423b7ed81cf18ae1150de319b6392c487406d87aaadfef88a7e5dddfbd3791df  site/docs/live-application-capture/screenshots/step-08-open-banking.png
9b067ed1ef5c5bd76f376842790b82504caf80abe2194f3cd4ca6ad9c8ccd7e3  site/docs/live-application-capture/screenshots/step-08.png
12380b4fd2c4da5916c8bae2267bdc078630890d190e915b396e58a40cee3eef  site/docs/live-application-capture/source/application-complete.html
8b038e19d29079491076818ff7b8795531242a8205de98460eec4e32e4463a51  site/docs/live-application-capture/source/application-declined.html
12380b4fd2c4da5916c8bae2267bdc078630890d190e915b396e58a40cee3eef  site/docs/live-application-capture/source/complete.html
14cf326bc0bd8fb70ae8109a3f0fbdc3872eaa466a0a5fd5a8e58bb7e317b7f1  site/docs/live-application-capture/source/step-eight-open-banking.html
12380b4fd2c4da5916c8bae2267bdc078630890d190e915b396e58a40cee3eef  site/docs/live-application-capture/source/step-eight-open-banking.js
32156c00c8dafc4ea6a88c0d0b458c47c7f174ca99ba000e518bee5c98633047  site/docs/live-application-capture/source/step-eight.html
6c4fd8e46c906955460b2240beae11aa4a25d8d06bbf901cb439602bdba640c4  site/docs/live-application-capture/source/step-eight.js
bcee0a083b5787f4de34a684ff588f85ad97f245c8d99ea10764543cd07c8f88  site/docs/live-application-capture/source/step-five.html
b4fd33e5a770092246353143e8dd242878319cf53615520831582c8e2783dc36  site/docs/live-application-capture/source/step-five.js
727311e7d8da976f4bdc16ba2c2278e4ce030a9f50b6d04458305c2c539ef9bd  site/docs/live-application-capture/source/step-four.html
28c1f5e40065d942d912cb0c3b7a593f2cf01fb37a48f88cede1810d02a3c8f1  site/docs/live-application-capture/source/step-four.js
59248994f0c09872d49c58f53efc4a57678bc1ec2055da2b87c4bfbc175eaa22  site/docs/live-application-capture/source/step-one.html
c39b49f3fd6bb53f4ba0fbf0bbb7296fe7f305aaffe0dfbe2549b34851ef319e  site/docs/live-application-capture/source/step-one.js
993236f7d05c7b0c39653fb67962791197717b00e35509b9ef196faf81b89866  site/docs/live-application-capture/source/step-seven.html
b4132cd18f4504d831d446fd2f0cc890c3fb9f7b14d94cda1220c4a20e492c07  site/docs/live-application-capture/source/step-seven.js
d098be04b9a6c8fa7038a8b8c3f46783a3f7973cfa3cc7fa3f8a0743e08aae61  site/docs/live-application-capture/source/step-six.html
a9d6fc0e4753836829744f9f6a65c15fd711bbaea96610dfdda133954d92bd1f  site/docs/live-application-capture/source/step-six.js
3adae98af28d54817eb71208a86c988d55bc05e4cebb5f9f34dd25c8a3a74379  site/docs/live-application-capture/source/step-three.html
361add09d545f9b9f4f7ad2510b36cfcb474c0447c00612a52677f98e0df58ee  site/docs/live-application-capture/source/step-three.js
4ee73dbee8847ec7b6ae8ed895f76e5bf98fac1f8e4d331bd3c7b4ca63b17623  site/docs/live-application-capture/source/step-two.html
39c9480805771cf6ca20ea015b3c344c6e00b23fd03e51709a231508a2321049  site/docs/live-application-capture/source/step-two.js
```
