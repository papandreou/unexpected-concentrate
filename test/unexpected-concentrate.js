/*global describe, it*/

var expect = require('unexpected').use(require('../'));
var c = require('concentrate');

expect.output.preferredWidth = 120;

it('should succeed', function () {
    expect(new Buffer([0x00, 0x39, 0x05, 0x66, 0x6f, 0x6f, 0x62, 0x61, 0x72]), 'to satisfy', c().uint8(0).uint16le(1337).string('foobar', 'utf-8'));
});

it('should fail with a diff', function () {
    expect(function () {
        expect(new Buffer([0x39, 0x05, 0x66, 0x6f, 0x6f, 0x62, 0x61, 0x72, 0x01]), 'to satisfy', c().uint8(0).uint16le(1337).string('foobar', 'utf-8'));
    }, 'to throw',
        "expected Buffer([0x39, 0x05, 0x66, 0x6F, 0x6F, 0x62, 0x61, 0x72, 0x01])\n" +
        "to satisfy concentrate().uint8(0).uint16le(1337).string('foobar')\n" +
        "\n" +
        "// missing uint8(0)\n" +
        "39 05 ✓ uint16le(1337)\n" +
        "66 6F 6F 62 61 72 ✓ string('foobar')\n" +
        "01 // should be removed"
    );
});
