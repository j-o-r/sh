# SH (shell)

Easy execute "shell" commands from within your javascript files

```javascript

import {SH} from '@jorr/sh';
const ls = (await SH`ls -FLa`.pipe(SH`grep README.md`)).stdout;

```

## Install

```bash

npm i @jor/sh

```

## Project Overview

This project is inspired by the remarkable [zx](https://github.com/google/zx) library. 
However, it aims to provide a more streamlined approach by avoiding the overwriting of `globals` such as `fetch` and excluding libraries that may not be necessary for all users.

The main focus of this project is to offer the `core` functionality of `zx`, primarily the shell execution method.

## Project Progress / Task List

Currently, the project is in its early, alpha development phase.

- [ ] Develop test cases
- [ ] Refactor and upgrade code to ES2020 standards
- [ ] Create documentation

## License

This project is licensed under [Apache-2.0](LICENSE.txt).
