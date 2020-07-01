// @flow

import {AppRegistry} from 'react-native';
import AsyncStorage from '@react-native-community/async-storage';
import App from './src/App';
import {name as appName} from './app.json';
import {BleManager, LogLevel} from 'react-native-ble-plx';
import {Buffer} from 'buffer';
import {getTimeHex} from './src/time';

import BackgroundFetch from 'react-native-background-fetch';

const headlessTask = async ({taskId}) => {
  console.log('App NOT working but Event activated: ', taskId);

  if (taskId === 'react-native-background-fetch') {
    console.log('HeadlessJS Working: ', taskId);
    //백그라운드 페치 이벤트 핸들러
    console.log('Background(not headless) Working: ', taskId);

    let datetime = new Date();
    let hours = datetime.getHours();
    let minutes = datetime.getMinutes();
    let trans = 'hereItIs';
    if (hours < 6) {
      console.log('not running time: ' + hours);
      BackgroundFetch.finish(taskId);
      return;
    }
    let deviceIDs = [];
    let tempSyncData = await AsyncStorage.getItem('devices');
    if (tempSyncData !== null) {
      tempSyncData = tempSyncData.split(';');
      tempSyncData = tempSyncData.map((tempSyncDatum, index) => {
        if (tempSyncDatum !== '') {
          return tempSyncDatum.split(',');
        }
        return null;
      });
      tempSyncData = tempSyncData.filter(function (value, index, arr) {
        return value != null;
      });

      tempSyncData.forEach((info) => {
        const lastUpdate = parseInt(info[1]);

        const checkYesterday =
          lastUpdate <
            datetime.getTime() - 1000 * 60 * 60 * datetime.getHours() &&
          lastUpdate >
            datetime.getTime() - 1000 * 60 * 60 * (datetime.getHours() + 24);

        const checkToday =
          lastUpdate >
          datetime.getTime() - 1000 * 60 * 60 * datetime.getHours();
        // 오늘 했으면 일단 ㄴㄴ, 어제 안했으면 시간 관계없이 ㄱ,
        const now =
          !checkToday &&
          (!checkYesterday || (hours === 21 && minutes > 29) || hours >= 22);
        if (now) {
          deviceIDs.push(info[0]);
        }
      });
    }

    console.log(deviceIDs.length.toString() + ' Device(s) to Update');
    if (deviceIDs.length !== 0) {
      const manager = new BleManager({
        restoreStateIdentifier: 'BleInTheBackground',
        restoreStateFunction: (restoredState) => {
          if (restoredState == null) {
            // BleManager was constructed for the first time.
          } else {
            // BleManager was restored. Check `restoredState.connectedPeripherals` property.
          }
        },
      });

      manager.setLogLevel(LogLevel.Verbose);
      try {
        const subscription = await manager.onStateChange(async (state) => {
          if (state === 'PoweredOn') {
            async function processArray(deviceIDs) {
              for (const id of deviceIDs) {
                try {
                  await this.manager.writeCharacteristicWithoutResponseForDevice(
                    id,
                    '8a0d7f02-b80c-4335-8e5f-630031415354',
                    '8a0dfff1-b80c-4335-8e5f-630031415354',
                    Buffer.from('FC0100FD', 'hex').toString('base64'),
                    'shakehand',
                  );
                  await this.manager.cancelTransaction('shakehand');
                } catch (e) {}
                try {
                  // const isConnected = await manager.isDeviceConnected(id);
                  // console.log('isConnected: ' + isConnected);
                  // if (isConnected) {
                  //   await manager.cancelDeviceConnection(id);
                  // }
                  await manager
                    .connectToDevice(id)
                    .then((device) => {
                      return device.discoverAllServicesAndCharacteristics();
                    })
                    .then((device) => {
                      return device.services();
                    })
                    .then(async (services) => {
                      for (const service of services) {
                        console.log('connected');
                        if (
                          service.uuid ===
                          '8a0d7f02-b80c-4335-8e5f-630031415354'
                        ) {
                          const characteristics = await service.characteristics();

                          const noti = await characteristics[1].monitor(
                            (error, characteristic) => {
                              if (error) {
                                console.log('Notify Error: ' + error);
                              } else
                                console.log(
                                  Buffer.from(
                                    characteristic.value,
                                    'base64',
                                  ).toString(),
                                );
                            },
                            trans,
                          );

                          // const shakeHand = 'FC0100FD';
                          // await characteristics[0].writeWithoutResponse(
                          //   Buffer.from(shakeHand, 'hex').toString('base64'), //RkMwMTAwRkQ= // 쉐이크 핸드
                          // );

                          const BCC0000 =
                            'FC021042574300000000000000303030300000AA';
                          await characteristics[0].writeWithoutResponse(
                            Buffer.from(BCC0000, 'hex').toString('base64'), //name and password
                          );

                          try {
                            console.log('Writing time start');
                            const dateHex = await getTimeHex();
                            console.log('dateHex: ' + dateHex);
                            await characteristics[0]
                              .writeWithoutResponse(
                                Buffer.from(dateHex, 'hex').toString('base64'),
                              )
                              .then(async () => {
                                console.log('write done');
                                const n = new Date().getTime();
                                // let bf =
                                //   (await AsyncStorage.getItem('devices')) || '';
                                // let sd = bf.split(';');
                                // if (sd[0] !== '' && sd.length > 5) {
                                //   bf = '';
                                //   for (let j = 0; j < 5; j++) {
                                //     bf += sd[j] + ';';
                                //   }
                                // }
                                // await AsyncStorage.setItem(
                                //   'devices',
                                //   id + ',' + n.toString() + ';' + bf,
                                // );
                                // await AsyncStorage.setItem(id, n.toString());

                                let bf = '';
                                let tempArray = [];
                                let tempSyncData = await AsyncStorage.getItem(
                                  'devices',
                                );
                                if (tempSyncData !== null) {
                                  tempSyncData = tempSyncData.split(';');
                                  tempSyncData = tempSyncData.map(
                                    (tempSyncDatum, index) => {
                                      if (tempSyncDatum !== '') {
                                        return tempSyncDatum.split(',');
                                      }
                                      return null;
                                    },
                                  );
                                  tempSyncData = tempSyncData.filter(function (
                                    value,
                                    index,
                                    arr,
                                  ) {
                                    return value != null;
                                  });
                                  tempSyncData = tempSyncData.filter(function (
                                    value,
                                    index,
                                    arr,
                                  ) {
                                    return value[0] !== id;
                                  });
                                  //tempSyncData = [{id, n}, {id, n}, {id, n} ...]
                                  tempArray = tempSyncData.map(
                                    (tempSyncDatum, index) => {
                                      return (
                                        tempSyncDatum[0] +
                                        ',' +
                                        tempSyncDatum[1]
                                      );
                                    },
                                  );
                                  tempArray.map((arrayElement, index) => {
                                    bf += arrayElement + ';';
                                  });
                                }
                                await AsyncStorage.setItem(
                                  'devices',
                                  id + ',' + n.toString() + ';' + bf,
                                );
                                await AsyncStorage.setItem(id, n.toString());
                                if (
                                  trans != '' ||
                                  trans != undefined ||
                                  trans != null
                                ) {
                                  try {
                                    await this.manager.cancelTransaction(trans);
                                  } catch (e) {}
                                }
                                await manager.cancelDeviceConnection(id);
                              });
                          } catch (e) {
                            console.log('Writing failed: ' + e);
                            throw e;
                          }
                        }
                      }
                    })
                    .catch(async (e) => {
                      console.log(
                        'Error on Background(not headless) task: ' + e,
                      );
                      if (trans != '' || trans != undefined || trans != null) {
                        try {
                          await this.manager.cancelTransaction(trans);
                        } catch (e) {}
                      }
                      await manager.cancelDeviceConnection(id);
                      throw e;
                    });
                  //return true;
                } catch (e) {
                  throw e;
                }
              }
              console.log('Done!');
              return true;
            }
            await processArray(deviceIDs);
            manager.destroy();
            BackgroundFetch.finish(taskId);
          }
        }, true);
      } catch (e) {
        console.log(e);
        try {
          manager.destroy();
          BackgroundFetch.finish(taskId);
        } catch (e) {}
      }
    } else {
      BackgroundFetch.finish(taskId);
    }
  }
};

// async function stopAll(manager, taskId) {
//   try {
//     await manager.stopDeviceScan();
//     await manager.destroy();
//     subscription.remove();
//     BackgroundFetch.finish(taskId);
//   } catch (e) {
//     try {
//       await manager.destroy();
//       subscription.remove();
//       BackgroundFetch.finish(taskId);
//     } catch (e) {
//       try {
//         subscription.remove();
//       } catch (e) {
//         try {
//           BackgroundFetch.finish(taskId);
//         } catch (e) {
//           console.log('finally done.');
//         }
//       }
//     }
//   }
// }

BackgroundFetch.registerHeadlessTask(headlessTask);

AppRegistry.registerComponent(appName, () => App);
