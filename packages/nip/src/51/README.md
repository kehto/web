# `@kehto/nip/51` — NIP-51 lists & sets

Parse [NIP-51](https://github.com/nostr-protocol/nips/blob/master/51.md) lists and
sets — mute lists, bookmarks, relay sets, follow sets, emoji sets, curation sets,
and more — into one structured shape, with an injected-decryptor path for private
items.

`nostr-tools` ships no NIP-51 helper. This module provides a single
widely-compatible parser plus item accessors.

## Two families

| Family | Kinds | Cardinality | Examples |
|--------|-------|-------------|----------|
| **Standard lists** | `10000`–`10101` | one per author per kind | mute (`10000`), bookmarks (`10003`), DM relays (`10050`) |
| **Sets** | `30000`–`30030` | many per author, keyed by `d` | follow sets (`30000`), relay sets (`30002`), emoji sets (`30030`) |

Item-bearing tags (`e`, `p`, `a`, `t`, `r`, `word`, `emoji`, `relay`, `g`, `i`,
`k`) become `publicItems`; metadata (`d`, `title`, `image`, `description`) is
lifted into named fields. Unknown kinds still parse (`family: 'unknown'`) so you
stay forward-compatible.

## API

| Export | Description |
|--------|-------------|
| `parseList(event)` | any list/set event → `Nip51List` |
| `getTagValues(items, name)` | collect `tag[1]` of every `name` item tag |
| `decryptPrivateItems(list, decrypt)` | populate `privateItems` via an injected NIP-44 decryptor |
| `isListKind` / `isSetKind` / `listKindName` | kind classification |
| `LIST_KINDS` / `SET_KINDS` / `ITEM_TAGS` | canonical tables |

## Usage

```ts
import { parseList, getTagValues } from '@kehto/nip/51';

const mute = parseList(kind10000Event);
mute.type;                               // 'mute'
const mutedPubkeys = getTagValues(mute.publicItems, 'p');
const mutedWords = getTagValues(mute.publicItems, 'word');

const followSet = parseList(kind30000Event);
followSet.address;                       // '30000:<pubkey>:<d>'
followSet.title;                         // 'Close Friends'
```

### Private items (no crypto dependency)

NIP-51 stores private items as a NIP-44-encrypted JSON tag array in `content`.
This package stays crypto-free — inject your signer's `nip44.decrypt`:

```ts
const withPrivate = await decryptPrivateItems(mute, (content, author) =>
  window.nostr!.nip44!.decrypt(author, content),
);
const privatelyMuted = getTagValues(withPrivate.privateItems!, 'p');
```

`decryptPrivateItems` returns a **new** list (the input is not mutated) and
throws if the plaintext is not a `string[][]` tag array, so you can tell "no
private items" from "couldn't read them".
