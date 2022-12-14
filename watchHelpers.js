const watchUpdateTypes = [
    'TX_LUX_WHITELUX',          //0
    'TX_TEMP_HUMD',             //1
    'TX_SURVEY_INITIALIZED',    //2
    'TX_TIME_EST',              //3
    'TX_TIME_SEEN',             //4
    'TX_SURVEY_RESULT',         //5
    'TX_PREVIOUS_INVALID',      //6
    'TX_TIMESTAMP_UPDATE',      //7
    'TX_BEGIN_PAUSE'];          //8

const watchSurveyTypes = [
    'SURVEY_NONE',
    'SURVEY_FOCUS',
    'SURVEY_AROUSAL',
    'SURVEY_VALENCE',
    'SURVEY_COGLOAD',
    'SURVEY_TIMECUE',
    'SURVEY_CAFFEINE',
    'SURVEY_EXERCISE',
    'SURVEY_STRESS',
    'SURVEY_LOCATE',
    'SURVEY_TSENSE',
    'SURVEY_TCOMFORT'


];


Date.prototype.stdTimezoneOffset = function () {
var jan = new Date(this.getFullYear(), 0, 1);
var jul = new Date(this.getFullYear(), 6, 1);
return Math.max(jan.getTimezoneOffset(), jul.getTimezoneOffset());
}

Date.prototype.isDstObserved = function () {
    return this.getTimezoneOffset() < this.stdTimezoneOffset();
}

function getDateInBCD(format12 = false){
    //returns DAY (1byte) MONTH (1byte) DATE (1byte) YEAR (1byte) HR (1byte)
    //MIN (1byte) SEC (1byte) 12HRFORMAT (1byte, 0=24HR) AMorPM (1byte, 0=AM)
    //DAYLIGHTSAVINGS (1byte, 0=None 1=Add1hr)
    //all as a string

    //BCD means we use 0x01-0x12, skipping 0x0A-0x0F (hex *reads* right)
    var day = ("0" + new Date().getDay()).slice(-2);          //uint8_t 0x01-0x07, Mon-Sun
    var month = ("0" + (new Date().getMonth() + 1)).slice(-2);  //uint8_t 0x01-0x12
    var date = ("0" + new Date().getDate()).slice(-2);        //uint8_t 0x01-0x31
    var year = String(new Date().getFullYear()).slice(-2);    //uint8_t 0x20

    var hour = new Date().getHours();    //uint8_t Hours 0x00-0x023 if RTC_HourFormat_24, 0x00 to 0x12 if RTC_HourFormat_12
    var min  = ("0" + new Date().getMinutes()).slice(-2); //uint8_t Min 0x00 to 0x59
    var sec  = ("0" + new Date().getSeconds()).slice(-2); //uint8_t Sec 0x00 to 0x59

    //uint8_t TimeFormat to 0x00 for FORMAT12_AM, 0x40 for FORMAT12_PM
    var formatAM = hour >= 12 ? 1 : 0;
    if (format12) { hour = hour % 12; hour = hour ? hour : 12;}
    hour = ("0" + hour).slice(-2);

    //uint32_t DayLightSavings; use RTC_DAYLIGHTSAVINGS_SUB1H, RTC_DAYLIGHTSAVINGS_ADD1H, or RTC_DAYLIGHTSAVING_NONE
    var daylight = new Date().isDstObserved() ? 1 : 0; // if 1, ADD1H; else NONE

    return day + month + date + year + hour + min + sec  + '0' + formatAM  + '0' + (format12 ? 1 :0) + '0' + daylight;
}

function hexToFloat(str) {
    return Buffer.from(str,'hex').readFloatBE(0);
}

//-- WATCH RX --//
module.exports.processWatchPacket = function(value) {

        hexval = value.reverse().toString('hex');
        timestamp = hexval.slice(0, 16);
        updateType = watchUpdateTypes[parseInt(hexval.slice(16,20))];

        switch (updateType){
            case 'TX_LUX_WHITELUX':
            case 'TX_TEMP_HUMD':
                data = [hexToFloat(hexval.slice(20,28)), hexToFloat(hexval.slice(28))];
                break;
            case 'TX_SURVEY_INITIALIZED':
            case 'TX_PREVIOUS_INVALID':
            case 'TX_BEGIN_PAUSE':
                data = '';
                break;
            case 'TX_TIME_EST':
                data = parseInt(hexval.slice(20,22), 16) + ':' + parseInt(hexval.slice(22), 16);
                break;
            case 'TX_SURVEY_RESULT':
                data = [watchSurveyTypes[parseInt(hexval.slice(20,22), 16)], parseInt(hexval.slice(22), 16)];
                break;
            case 'TX_TIMESTAMP_UPDATE':
                hexdata = hexval.slice(20);
                data = parseInt(hexdata, 16);
                if ((data & 0x8000) > 0) {
                    data = data - 0x10000;
                }
                break;
            default:
                data = hexval.slice(20);
        }


        days = ['Sun', 'Mon', 'Tues', 'Wednes', 'Thurs', 'Fri', 'Sat'];
        var human_timestamp = days[parseInt(timestamp.substring(0,2))] + ', ' +
                              timestamp.substring(2,4) + '/' + timestamp.substring(4,6) + '/' + timestamp.substring(6,8) + ' ' +
                              timestamp.substring(8,10) + ':' + timestamp.substring(10,12) + ':' + timestamp.substring(12,14);

        return [new Date(human_timestamp), updateType, data];
}

//-- WATCH TX --//
module.exports.constructWatchTXTimestamp = function(){
    var timestamp_string = getDateInBCD();
    return '00' + timestamp_string;
}

module.exports.constructWatchTXTimeBounds = function(startHr=8, endHr=23){
    var startHR_BCD = ('0' + startHr).slice(-2);
    var endHR_BCD = ('0' + endHr).slice(-2);
    return '01' + startHR_BCD + endHR_BCD;
}

module.exports.constructWatchTXPause = function(paused=true){
  if(paused) return '0201';
  else return '0200';
}
