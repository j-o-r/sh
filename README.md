# SH (shell)

Easy execute "shell" commands from within your javascript files

```javascript

import {SH} from 'jorr-sh';
const ls = (await SH`ls -FLa`.pipe(SH`grep README.md`)).stdout;

```

## Project Description

I appreciate the excellent [zx](https://github.com/google/zx) library, 
but it overwrites `globals` such as `fetch` and provides libraries which I don't want or need.

This project contains the `core` of `zx` and solely provides the shell execution method.


## Current Status / To-Do List

This is an initial, alpha stage effort.

- [ ] Write tests
- [ ] Convert/refactor code to ES2022
- [ ] Write documentation and JSDoc

## License

This project is licensed under [Apache-2.0](LICENSE.txt).
