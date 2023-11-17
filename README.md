# @j-o-r/sh

Execute shell commands from JavaScript.

![[jor-sh.png]]

## Introduction

BETA

This Node.js module, `@j-o-r/sh`, simplifies the execution of shell commands within JavaScript applications. It provides a range of utilities to handle shell scripts and manage their output efficiently.

This project draws inspiration from the exceptional [zx library](https://github.com/google/zx). The core functionality of zx, particularly the shell execution method, has been extracted and forms the foundation of this project.

## Installation

Install the module using npm:

```sh
npm install @j-o-r/sh
```

## Usage

### Basic Usage

To execute a shell command, use the `SH` function:

```javascript
import { SH, cd, within, sleep, retry, expBackoff } from '@j-o-r/sh';

SH`your_shell_command`
  .then(output => {
    console.log('Output:', output);
  })
  .catch(error => {
    console.error('Error:', error);
  });
```

```javascript

const res = await SH`ls -FLa`.pipe(SH`grep package.json`);
console.log(res.toString());

const ar = within(async () => {
	const res = await Promise.all([
		SH`sleep 1; echo 1`,
		SH`sleep 2; echo 2`,
		sleep(2),
		SH`sleep 3; echo 3`
	]);
});

``` 

```javascript
const p = await retry(3, expBackoff(), () => SH`curl -s https://unreachable:`);
```

The `SH` method accepts a template literal string enclosed in backticks as its argument. It returns a `ProcessPromise`. Once this promise is resolved, it yields a `ProcessOutput` object.
### Additional Utilities

The module also provides additional utilities for common tasks:

- `cd(dir)`: Change the working directory.
- `sleep(duration)`: Pause execution for a specified duration.
- `retry(count, interval, callback)`: Retry a command a specified number of times with an optional interval.
- `stdin()`: Read from standard input.
- `within(callback)`: Create an async context in a sync block.
- `expBackoff(max, rand)`: Generate intervals for exponential backoff.


## ProcessPromise

This class is returned by the shell command. Here's a summary of its methods and properties:

### Methods

- **pipe(dest)**: Pipes the output of this process to the input of another `ProcessPromise`
- **kill(signal = 'SIGTERM')**: Sends a kill signal to the child process.
- **stdio(stdin, stdout, stderr)**: Sets the standard input/output/error streams for the child process.
- **nothrow()**: Configures the promise not to throw an error when the command execution fails.
- **quiet()**: Suppresses log output.
- **verbose()**: Enables verbose log output.
- **timeout(d, signal = 'SIGTERM')**: Sets a timeout for killing the process.
- **halt()**: Stops the execution of the next step in the process.

### Getters

- **stdin**: Returns the standard input stream of the child process.
- **stdout**: Returns the standard output stream of the child process.
- **stderr**: Returns the standard error stream of the child process.
- **exitCode**: Returns a promise that resolves to the exit code of the child process.

### Properties

- **isHalted**: A getter that returns a boolean indicating whether the promise is halted.

## Output

The `ProcessOutput` class collects output from the `ProcessPromise` shell process. It extends the `Error` class to provide compatibility with error handling mechanisms. Here's a summary of its features:


### Getters

- **stdout**: Returns the standard output (stdout) of the child process as a string.
- **stderr**: Returns the error output (stderr) of the child process as a string.
- **exitCode**: Returns the exit code of the process as a number.
- **signal**: Returns the signal received by the process, such as 'SIGTERM', as a string.

### Methods

- **toString()**: 
  - Returns a trimmed string combining `stderr` and `stdout`. 
  - This method is automatically invoked by various JavaScript methods for output consolidation.
- **[inspect.custom]()**:
  - Custom inspection method used for debugging.
  - Displays the current state of the object when passed to `console.log`.

### Examples

- Script for setting up my wokspace in [TMUX](./workspace.js)
- Take a look at the [test](./test/sh.js)

## Contributing

Contributions are welcome. Please submit issues and pull requests on our [GitHub repository](https://github.com/j-o-r/sh).

## License

This project is licensed under the Apache License, Version 2.0.

