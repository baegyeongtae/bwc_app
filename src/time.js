export async function getTimeHex() {
  let datetime;
  try {
    let response = await fetch('https://worldtimeapi.org/api/ip');
    let responseJson = await response.json();
    datetime = new Date(responseJson.datetime);
  } catch (error) {
    console.log('이새끼 실패했대요.', error);
    datetime = new Date();
  }

  let firstHeader = 252;
  let secondHeader = 3;
  let thirdHeader = 7;

  let milliseconds = Math.round(datetime.getMilliseconds() / 10);
  let seconds = datetime.getSeconds();
  let minutes = datetime.getMinutes();
  let hours = datetime.getHours();
  let day = datetime.getDate();
  let month = datetime.getMonth() + 1;
  let year = datetime.getYear() - 100;

  let parity =
    (year +
      month +
      day +
      hours +
      minutes +
      seconds +
      milliseconds +
      firstHeader +
      secondHeader +
      thirdHeader) %
    256;
  let hex = '';
  hex += itx(firstHeader);
  hex += itx(secondHeader);
  hex += itx(thirdHeader);
  hex += itx(milliseconds);
  hex += itx(seconds);
  hex += itx(minutes);
  hex += itx(hours);
  hex += itx(day);
  hex += itx(month);
  hex += itx(year);
  hex += itx(parity);

  // console.log(responseJson.datetime);
  // console.log(year);
  // console.log(month);
  // console.log(day);
  // console.log(hours);
  // console.log(minutes);
  // console.log(seconds);
  // console.log(milliseconds);
  // console.log(parity);

  return hex;
}

function itx(data) {
  let a = parseInt(data, 10).toString(16);
  if (a.length === 1) {
    a = '0' + a;
  }
  return a;
}
export function unixTimeToTime(time) {
  // eslint-disable-next-line radix
  let datetime = new Date(parseInt(time));

  let seconds = datetime.getSeconds();
  let minutes = datetime.getMinutes();
  let hours = datetime.getHours();
  let day = datetime.getDate();
  let month = datetime.getMonth() + 1;
  let year = datetime.getFullYear();
  seconds = checkZero(seconds);
  minutes = checkZero(minutes);
  hours = checkZero(hours);
  day = checkZero(day);
  month = checkZero(month);

  let times =
    year +
    '-' +
    month +
    '-' +
    day +
    ' ' +
    hours +
    ':' +
    minutes +
    ':' +
    seconds;

  return times;
}

function checkZero(data) {
  if (data < 10) {
    return '0' + data.toString();
  }
  return data.toString();
}
