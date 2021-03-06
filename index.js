const EventEmitter = require('events').EventEmitter;
const SerialPort = require('serialport');
const Readline = require('@serialport/parser-readline');

function parse_frx(line) {
    const data = line.split(',').map(parseFloat);
    const F = data[0];
    const R = data[1];
    const X = data[2];
    const XX = X * X;
    const Rm = (R - 50) * (R - 50);
    const Rp = (R + 50) * (R + 50);
    const N = Math.sqrt(Rm + XX);
    const D = Math.sqrt(Rp + XX);
    const G = N / D;
    let vswr = (1 + G) / (1 - G);
    if (vswr < 0 || vswr > 99) vswr = 99;
    return { frequency: F * 1000000, vswr };
}

class AA30Zero extends EventEmitter {

    constructor (port) {

        super();

        this._queue = []; // { cmd, expect }
        this._handle = new SerialPort(port, { baudRate: 38400 });
        this._discard = false;
        this._sample = 0;
        this._frequency = 0;
        this._vswr = 100;

        this._handle.pipe(new Readline({ delimiter: '\r\n' })).on('data', data => {
            if (this._queue.length && data.search(this._queue[0].expect) > -1) {
                const cmd = this._queue.shift();
                if (cmd.callback !== null) cmd.callback(data);
                if (this._queue.length) {
                    this._handle.write(this._queue[0].cmd + '\r\n');
                }
            } else if (data.search(/^.*,.*,.*$/) > -1) {
                if (!this._discard) {
                    const d = parse_frx(data);
                    d.sample = this._sample;
                    this._sample++;
                    if (d.vswr < this._vswr) {
                        this._frequency = d.frequency;
                        this._vswr = d.vswr;
                    }
                    this.emit('measurement', d);
                }
            }
        });

    }

    _write(cmd, expect = /^OK$/, callback = null) {
        this._queue.push({ cmd, expect, callback });
        if (this._queue.length == 1) this._handle.write(cmd + '\r\n');
    }

    version() {
        return new Promise(res => {
            this._write('ver', /^AA-30 ZERO \d+$/, data => res(data));
        });
    }

    scan(centre, range, samples) {
        this._sample = 0;
        this._frequency = 0;
        this._vswr = 100;
        this._write(`fq${centre}`);
        this._write(`sw${range}`);
        return new Promise(res => {
            this._write(`frx${samples}`, /^OK$/, () => {
                res({ frequency: this._frequency, vswr: this._vswr });
                this._discard = false;
            });
        });
    }

    park(frequency) {
        this._discard = true;
        return this.scan(frequency, 1, 1);
    }

}

module.exports = AA30Zero;
