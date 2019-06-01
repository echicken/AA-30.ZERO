# AA-30.ZERO
Use an AA-30.ZERO antenna analyzer with node.js.

```javascript
const AA30Zero = require('./index.js');

const aa30 = new AA30Zero('/dev/ttyS0');
aa30.on('measurement', console.log);
aa30.init();
aa30.version().then(v => console.log('version', v));
aa30.scan('24848000', '10000', '100').then(data => {
    console.log('Lowest VSWR', data);
});
```

### Constructor

Just pass the path to your serial port, eg. 'COM4' or '/dev/ttyUSB0':

```javascript
new AA30Zero('/dev/ttyS0');
```

### Methods

* **init()** - _Required_ - Sets up event handling and data parsing
* **version()** - Request the AA-30.ZERO's version string
    * Returns a _Promise_ which resolves with the version string
* **scan(centre, range, samples)** - Perform a scan
    * _centre_ is the centre frequency in Hz (eg. 14150000)
    * _range_ is the sweep range in Hz (eg. 100000 to sweep 50 KHz on either side of _centre_)
    * _samples_ is the number of readings to take across _range_
    * Returns a _Promise_ which resolves with { frequency, vswr } of the measurement with the lowest VSWR

### Events

* **measurement** - Emitted for each measurement that is taken during a scan
    * Callback receives an object parameter with _frequency_ and _vswr_ properties
