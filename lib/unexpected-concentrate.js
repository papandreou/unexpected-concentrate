var arrayChanges = require('array-changes');

function bufferCanBeInterpretedAsUtf8(buffer) {
    // Hack: Since Buffer.prototype.toString('utf-8') is very forgiving, convert the buffer to a string
    // with percent-encoded octets, then see if decodeURIComponent accepts it.
    try {
        decodeURIComponent(Array.prototype.map.call(buffer, function (octet) {
            return '%' + (octet < 16 ? '0' : '') + octet.toString(16);
        }).join(''));
    } catch (e) {
        return false;
    }
    return true;
}

function getJobInfo(job) {
    var methodName = job.method;
    var arg = job.data;
    var matchMethodName = methodName && methodName.match(/^write(Int|UInt|Float|Double)(8|16|32|)(LE|BE|)$/);
    if (matchMethodName) {
        if (matchMethodName[1] === 'Int' || matchMethodName[1] === 'UInt') {
            methodName = (matchMethodName[1] === 'Int' ? 'sint' : 'uint') + matchMethodName[2] + matchMethodName[3].toLowerCase();
        } else if (matchMethodName[1] === 'Float' || matchMethodName[1] === 'Double') {
            methodName = matchMethodName[1].toLowerCase() + matchMethodName[3].toLowerCase();
        }
    } else if (bufferCanBeInterpretedAsUtf8(job.data)) {
        methodName = 'string';
        arg = arg.toString();
    } else {
        methodName = 'buffer';
    }
    return {methodName: methodName, arg: arg};
}

module.exports = {
    name: 'unexpected-concentrate',
    version: require('../package.json').version,
    installInto: function unexpectedConcentrate(expect) {
        expect.addType({
            name: 'Concentrate',
            identify: function (obj) {
                return obj && obj.constructor && obj.constructor.name === 'Concentrate';
            },
            inspect: function (concentrate, depth, output, inspect) {
                output.jsFunctionName('concentrate').text('()');
                concentrate.jobs.forEach(function (job) {
                    var jobInfo = getJobInfo(job);
                    output.text('.').jsFunctionName(jobInfo.methodName).text('(').appendInspected(jobInfo.arg).text(')');
                });
            }
        });

        expect.addStyle('concentrateHexOctets', function (octets) {
            octets.forEach(function (octet, i) {
                this.sp(i > 0 ? 1 : 0).text((octet < 16 ? '0' : '') + octet.toString(16).toUpperCase());
            }, this);
        })

        expect.addAssertion('<binaryArray> to satisfy <Concentrate>', function (expect, subject, value) {
            var expectedOctets = Array.prototype.slice.call(value.result());
            var changes = arrayChanges(Array.prototype.slice.call(subject), expectedOctets, function (a, b) {
                return a === b;
            });
            if (!changes.every(function (change) { return change.type === 'equal'; })) {
                var jobNumberByExpectedIndex = new Array(expectedOctets);
                var octetNumberInJobByExpectedIndex = new Array(expectedOctets);
                var offset = 0;
                for (var i = 0 ; i < value.jobs.length ; i += 1) {
                    for (var j = 0 ; j < value.jobs[i].length ; j += 1) {
                        jobNumberByExpectedIndex[j + offset] = i;
                        octetNumberInJobByExpectedIndex[j + offset] = j;
                    }
                    offset += value.jobs[i].length;
                }
                expect.fail({
                    diff: function (output) {
                        for (var i = 0 ; i < changes.length ; i += 1) {
                            output.nl(i > 0 ? 1 : 0);
                            var change = changes[i];
                            var partOfJobNumber = jobNumberByExpectedIndex[change.expectedIndex];
                            var job = typeof partOfJobNumber === 'number' && value.jobs[partOfJobNumber];
                            var isCompleteJob = !!job;
                            var octets = [change.value];
                            if (job) {
                                for (var j = 1 ; j < job.length ; j += 1) {
                                    var otherChange = changes[j + i];
                                    var jobNumber = typeof change.expectedIndex === 'number' && jobNumberByExpectedIndex[change.expectedIndex];
                                    var otherJobNumber = otherChange && typeof otherChange.expectedIndex === 'number' && jobNumberByExpectedIndex[otherChange.expectedIndex];
                                    if (typeof otherJobNumber !== 'number' || otherChange.type !== change.type || jobNumber !== otherJobNumber) {
                                        isCompleteJob = false;
                                        break;
                                    } else {
                                        octets.push(otherChange.value);
                                    }
                                }
                            }
                            if (isCompleteJob) {
                                i += job.length - 1;
                            } else {
                                octets = [octets[0]];
                            }
                            var jobInfo = job && getJobInfo(job);
                            if (change.type === 'insert') {
                                output.annotationBlock(function () {
                                    this.error('missing').sp();
                                    if (jobInfo) {
                                        this.jsFunctionName(jobInfo.methodName).text('(').appendInspected(jobInfo.arg).text(')');
                                    } else {
                                        this.concentrateHexOctets(octets);
                                    }
                                });
                            } else if (change.type === 'remove') {
                                output.concentrateHexOctets(octets).sp().annotationBlock(function () {
                                    this.error('should be removed');
                                });
                            } else if (change.type === 'equal') {
                                output.concentrateHexOctets(octets);
                                if (jobInfo) {
                                    output.sp().green('\u2713').sp();
                                    if (!isCompleteJob) {
                                        output.text('part of').sp();
                                    }
                                    output.jsFunctionName(jobInfo.methodName).text('(').appendInspected(jobInfo.arg).text(')');
                                }
                            }
                        }
                        return output;
                    }
                });
            }
        });
    }
};
