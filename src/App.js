// @flow

import React from 'react';
import {Provider} from 'react-redux';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  PermissionsAndroid,
  Platform,
  ScrollView,
  StatusBar,
  Dimensions,
  Modal,
  TouchableWithoutFeedback,
  Animated,
  ImageBackground,
} from 'react-native';
import AsyncStorage from '@react-native-community/async-storage';
import {BleManager, LogLevel} from 'react-native-ble-plx';
import {Buffer} from 'buffer';
import {getTimeHex, unixTimeToTime} from './time';
import BackgroundFetch from 'react-native-background-fetch';

const {height, width} = Dimensions.get('window');

export default class App extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      BLEData: [],
      syncing: false,
      modalControl: false,
      syncData: [],
      devices: [],
      animation: new Animated.Value(0),
      bluetoothOff: false,
      success: '',
    };
    this.heightStyle = {
      marginTop: this.state.animation.interpolate({
        inputRange: [0, 1],
        outputRange: [-15, 0],
      }),
      paddingBottom: this.state.animation.interpolate({
        inputRange: [0, 1],
        outputRange: [15, 0],
      }),
    };

    this.inner = {
      borderRadius: this.state.animation.interpolate({
        inputRange: [0, 1],
        outputRange: [12, 16],
      }),
    };

    this.manager = new BleManager({
      restoreStateIdentifier: 'BleInTheBackground',
      restoreStateFunction: (restoredState) => {
        if (restoredState == null) {
          // BleManager was constructed for the first time.
        } else {
          // BleManager was restored. Check `restoredState.connectedPeripherals` property.
        }
      },
    });

    this.manager.setLogLevel(LogLevel.Verbose);
  }

  async componentDidMount() {
    this.init();
    this.getPermission();
  }

  componentWillUnmount() {
    this.manager.destroy();
  }

  async init() {
    // 백그라운드 페치 초기 설정
    await BackgroundFetch.configure(
      {
        minimumFetchInterval: 60, // <-- minutes (15 is minimum allowed)
        // Android options
        forceAlarmManager: true, // <-- Set true to bypass JobScheduler.
        stopOnTerminate: false,
        startOnBoot: true,
        enableHeadless: true,
        requiredNetworkType: BackgroundFetch.NETWORK_TYPE_NONE, // Default
        requiresBatteryNotLow: false, // Default
        requiresStorageNotLow: false, // Default
        requiresCharging: false, // Default
        requiresDeviceIdle: false, // Default
      },
      this.onBackgroundFetchEvent,
      (error) => {
        console.log('[js] RNBackgroundFetch failed to start');
      },
    );
    console.log('background started!');
  }

  async onBackgroundFetchEvent(taskId) {
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
                  // const isConnected = await manager.isDeviceConnected(id);
                  // console.log('isConnected: ' + isConnected);
                  // if (isConnected) {
                  //   await manager.cancelDeviceConnection(id);
                  // }

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
                                let n = new Date().getTime();
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

  async getPermission() {
    if (Platform.OS === 'android' && Platform.Version >= 23) {
      console.log('Scanning: Checking permissions...');
      const enabled = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
      );
      if (!enabled) {
        console.log('Scanning: Permissions disabled, showing...');
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
        );

        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          console.log('Scanning: Permissions not granted, aborting...');
          // TODO: Show error message?
        } else {
          //await this.scan();
        }
      } else {
        //await this.scan();
      }
    } else if (Platform.OS === 'ios') {
      //await this.scan();
    }
  }

  async scan() {
    return new Promise((resolve, reject) => {
      const subscription = this.manager.onStateChange(async (state) => {
        if (state === 'PoweredOn') {
          console.log('powered ON!');
          setTimeout(() => {
            this.manager.stopDeviceScan();
            subscription.remove();
            resolve(true);
          }, 20000);
          await this.manager.startDeviceScan(
            ['8a0d7f02-b80c-4335-8e5f-630031415354'],
            {allowDuplicates: true},
            async (error, scannedDevice) => {
              console.log('scan working on foreground: ' + scannedDevice.name);
              if (error) {
                console.log('error on scanning: ' + error);
                return;
              }
              if (
                scannedDevice !== null &&
                scannedDevice.serviceData !== null &&
                scannedDevice.serviceData !== undefined
              ) {
                console.log('scanning');
                if (
                  Object.keys(scannedDevice.serviceData)[0].substr(4, 4) ===
                  '7f02'
                ) {
                  // got device.
                  console.log('device scanned: ' + scannedDevice.id);
                  const isAlreadyAdded = this.state.BLEData.find(
                    (item) => item === scannedDevice.id,
                  );
                  if (!isAlreadyAdded) {
                    this.setState({
                      BLEData: [...this.state.BLEData, scannedDevice.id],
                    });
                  }
                }
              }
            },
          );
          subscription.remove();
        } else {
          console.log(state);
          this.setState({bluetoothOff: true});
          subscription.remove();
          resolve(true);
        }
      }, true);
    });
  }

  async updateAll() {
    this.setState({syncing: true, bluetoothOff: false});
    await this.scan();
    // for (let i = 0; i < this.state.BLEData.length; i++) {
    //   await this.bindUpdate(this.state.BLEData[i]);
    // }
    await Promise.all(
      this.state.BLEData.map(async (d) => {
        await this.bindUpdate(d);
      }),
    );
    //this.setState({syncing: false});
    if (this.state.BLEData.length === 0) {
      this.setState({success: 'Please Sync Again'}, () => {
        setTimeout(() => {
          this.setState({success: '', syncing: false});
          this.handleButtonUp();
        }, 3000);
      });
    } else {
      this.setState({success: 'Success'}, () => {
        setTimeout(() => {
          this.setState({success: '', syncing: false});
          this.handleButtonUp();
        }, 3000);
      });
    }
  }

  async bindUpdate(id) {
    for (let i = 0; i < 5; i++) {
      try {
        const didIt = await this.updateTime(id);
        if (didIt) break;
      } catch (e) {
        console.log('failed... try again');
      }
    }
  }

  async updateTime(id) {
    this.setState({syncing: true});
    let trans = 'hereItIs';
    try {
      await this.manager.stopDeviceScan();
      // const isConnected = await this.manager.isDeviceConnected(id);
      // console.log('isConnected: ' + isConnected);
      // if (isConnected) {
      //   await this.manager.cancelDeviceConnection(id);
      // }
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
      await this.manager
        .connectToDevice(id)
        .then(async (device) => {
          return device.discoverAllServicesAndCharacteristics();
        })
        .then((device) => {
          return device.services();
        })
        .then(async (services) => {
          for (const service of services) {
            console.log('connected');
            if (service.uuid === '8a0d7f02-b80c-4335-8e5f-630031415354') {
              const characteristics = await service.characteristics();

              const noti = await characteristics[1].monitor(
                (error, characteristic) => {
                  if (error) {
                    console.log('Notify Error: ' + error);
                  } else
                    console.log(
                      Buffer.from(characteristic.value, 'base64').toString(),
                    );
                },
                trans,
              );

              // const shakeHand = 'FC0100FD';
              // await characteristics[0].writeWithoutResponse(
              //   Buffer.from(shakeHand, 'hex').toString('base64'), //RkMwMTAwRkQ= // 쉐이크 핸드
              // );

              const BCC0000 = 'FC021042574300000000000000303030300000AA';
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
                    let n = new Date().getTime();
                    // let bf = (await AsyncStorage.getItem('devices')) || '';
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
                    let tempSyncData = await AsyncStorage.getItem('devices');
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
                      tempArray = tempSyncData.map((tempSyncDatum, index) => {
                        return tempSyncDatum[0] + ',' + tempSyncDatum[1];
                      });
                      tempArray.map((arrayElement, index) => {
                        bf += arrayElement + ';';
                      });
                    }
                    await AsyncStorage.setItem(
                      'devices',
                      id + ',' + n.toString() + ';' + bf,
                    );
                    await AsyncStorage.setItem(id, n.toString());
                    if (trans != '' || trans != undefined || trans != null) {
                      try {
                        await this.manager.cancelTransaction(trans);
                      } catch (e) {}
                    }
                    await this.manager.cancelDeviceConnection(id);
                  });
              } catch (e) {
                console.log('Writing failed: ' + e);
                throw e;
              }
            }
          }
        })
        .catch(async (e) => {
          console.log('Error on Foreground task: ' + e);
          if (trans != '' || trans != undefined || trans != null) {
            try {
              await this.manager.cancelTransaction(trans);
            } catch (e) {}
          }
          await this.manager.cancelDeviceConnection(id);
          throw e;
        });
      return true;
    } catch (e) {
      throw e;
    }
  }

  handleAirhorn = async () => {
    try {
      Animated.timing(this.state.animation, {
        toValue: 1,
        duration: 100,
        useNativeDriver: false,
      }).start();
    } catch (e) {}
  };

  handleButtonUp = () => {
    Animated.timing(this.state.animation, {
      toValue: 0,
      duration: 50,
      useNativeDriver: false,
    }).start();
  };

  render() {
    return (
      <>
        <StatusBar hidden={true} />
        <View style={style.container}>
          <ImageBackground
            style={style.backgroundImage}
            source={require('../assets/images/gradient.png')}
            resizeMode="cover">
            <View
              style={{
                width: '100%',
                height: '100%',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 10,
              }}>
              <View style={style.topButtonContainer}>
                <TouchableOpacity
                  style={style.topButton}
                  onPress={async () => {
                    let datetime = new Date();
                    let tempSyncData = await AsyncStorage.getItem('devices');
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
                      this.setState({syncData: tempSyncData});
                    }
                    this.setState({modalControl: true});
                  }}>
                  <Text style={style.topButtonText}>≡{/* ··· */}</Text>
                </TouchableOpacity>
                <Text style={style.title}>Bluetooth Clock Control</Text>
              </View>
              <View style={{alignItems: 'center'}}>
                <TouchableWithoutFeedback
                  onPress={async () => {
                    this.handleAirhorn();
                    await this.updateAll();
                  }}
                  disabled={this.state.syncing}>
                  <View style={style.mainButton}>
                    <View style={style.mainOuter}>
                      <Animated.View
                        style={[style.mainHeight, this.heightStyle]}>
                        <Animated.View style={[style.mainInner, this.inner]}>
                          <Text style={style.mainWhite}>
                            {this.state.syncing
                              ? this.state.success === 'Success'
                                ? this.state.success
                                : 'WAIT...'
                              : 'SYNC'}
                          </Text>
                        </Animated.View>
                      </Animated.View>
                    </View>
                  </View>
                </TouchableWithoutFeedback>
                <View>
                  <Text
                    style={{
                      fontSize: 20,
                      fontWeight: 'bold',
                      textAlign: 'center',
                      color: 'rgb(10,30,150)',
                    }}>
                    {this.state.bluetoothOff
                      ? 'Please,\n Turn on bluetooth'
                      : this.state.success === 'Please Sync Again'
                      ? 'Please,\n Sync again'
                      : ''}
                  </Text>
                </View>
              </View>
              <View style={style.card}>
                <Text
                  style={{
                    color: '#000000',
                    width: '100%',
                    textAlign: 'center',
                  }}>
                  WorldTech Co. Ltd., Korea
                </Text>
              </View>
              {/* <View style={style.card}>
          {this.state.BLEData.length === 0 ? (
            <View
              style={{
                margin: 15,
                padding: 5,
                fontSize: 30,
                borderColor: 'black',
                borderRadius: 3,
                borderWidth: 2,
              }}>
              <Text>Scanning...</Text>
            </View>
          ) : (
            this.state.BLEData.map((uuid, index) => (
              <View
                key={index}
                style={{
                  margin: 15,
                  padding: 5,
                  fontSize: 30,
                  borderColor: 'black',
                  borderRadius: 3,
                  borderWidth: 2,
                }}>
                <TouchableOpacity
                  onPress={async () => {
                    console.log('syncing');
                    await this.bindUpdate(uuid);
                  }}
                  disabled={this.state.syncing}>
                  <Text>🕐 {index}</Text>
                  <Text>{uuid}</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View> */}
            </View>
          </ImageBackground>
        </View>

        <Modal
          animationType="fade"
          transparent={true}
          visible={this.state.modalControl}
          onRequestClose={() => {
            this.setState({modalControl: false});
          }}>
          <View style={style.modalBackgroundStyle}>
            <TouchableOpacity
              style={style.modalBackgroundStyle}
              onPress={() => {
                this.setState({modalControl: false});
              }}>
              <View style={style.modalStyle}>
                <View
                  style={{width: '100%', alignItems: 'center', height: '7%'}}>
                  <Text
                    style={{
                      fontSize: 20,
                      fontWeight: 'bold',
                      marginBottom: 10,
                    }}>
                    Sync History
                  </Text>
                </View>
                <View
                  style={{
                    width: '100%',
                    alignItems: 'center',
                    height: '93%',
                  }}>
                  <ScrollView style={{width: '100%'}}>
                    <View style={{width: '100%', alignItems: 'center'}}>
                      {this.state.syncData.length === 0 ? (
                        <View
                          style={{
                            width: '90%',
                            padding: 5,
                            borderColor: 'black',
                            borderRadius: 5,
                            borderWidth: 1,
                            marginVertical: 2,
                            alignItems: 'center',
                          }}>
                          <Text>Sync history not exist.</Text>
                        </View>
                      ) : (
                        this.state.syncData.map((datum, index) => {
                          let datetime = unixTimeToTime(datum[1]);
                          return (
                            <View
                              key={index + 1}
                              style={{
                                width: '90%',
                                padding: 5,
                                borderColor: 'black',
                                borderRadius: 5,
                                borderWidth: 1,
                                marginVertical: 2,
                              }}>
                              <Text>Device UUID: {datum[0]}</Text>
                              <Text>Sync Time: {datetime}</Text>
                            </View>
                          );
                        })
                      )}
                    </View>
                  </ScrollView>
                </View>
              </View>
            </TouchableOpacity>
          </View>
        </Modal>
      </>
    );
  }
}

const style = StyleSheet.create({
  Text: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    paddingBottom: 50,
    paddingTop: 20,
  },
  container: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    // justifyContent: 'space-between',
  },
  topButtonContainer: {
    width: '98%',
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  topButton: {
    //backgroundColor: '#eeeeee',
    width: '12%',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topButtonText: {
    fontSize: 30,
    fontWeight: 'bold',
    color: 'rgb(90,210,250)',
  },
  title: {
    width: '100%',
    color: 'white',
    fontSize: 25,
    marginTop: 60,
    //fontWeight: '500',
    marginBottom: 30,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  button: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'red',
  },
  card: {
    //backgroundColor: '#000000',
    width: '100%',
    borderRadius: 10,
    padding: 5,
  },
  itemContainer: {
    flex: 1,
    padding: 5,
  },
  item: {
    backgroundColor: '#2103',
    height: 150,
    justifyContent: 'center',
    borderRadius: 10,
    marginVertical: 5,
    marginHorizontal: 10,
  },
  itemTitle: {
    fontSize: 32,
    textAlign: 'center',
  },
  textStyle: {
    fontSize: 35,
    color: '#000',
    textAlign: 'center',
  },
  buttonStyle: {
    padding: 10,
    paddingHorizontal: 100,
    backgroundColor: '#fF6',
    borderRadius: 50,
    marginBottom: 30,
  },
  completedSync: {
    backgroundColor: '#fF6',
  },
  uncompletedSync: {
    backgroundColor: '#f47d',
  },
  completedText: {
    fontSize: 35,
  },
  uncompletedText: {
    fontSize: 35,
    color: '#000',
  },
  modalBackgroundStyle: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'black',
    opacity: 1,
  },
  modalStyle: {
    width: '90%',
    height: '90%',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    opacity: 1,
  },
  mainButton: {
    height: 80,
    width: 180,
  },
  mainOuter: {
    flex: 1,
    padding: 10,
    //backgroundColor: 'rgba(100,100,100,0.65)',
    borderRadius: 14,
    opacity: 1,
  },
  mainHeight: {
    backgroundColor: 'rgb(22, 65, 136)',
    borderRadius: 16,
  },
  mainInner: {
    height: '100%',
    backgroundColor: 'rgba(37, 138, 234, .5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainWhite: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 20,
  },
  backgroundImage: {
    width: '100%',
    height: '100%',
  },
});
