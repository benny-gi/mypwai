export type ScannerDeviceInfo = {
  deviceId: string;
  model: string;
  firmware: string;
  status: 'ready' | 'busy' | 'offline';
  lastCalibration: string;
  connectionType: 'hid' | 'usb' | 'serial';
};

export type FingerprintCapture = {
  template: string;
  quality: number;
  fingerLabel: string;
  captureTime: string;
};

type BrowserDevice = {
  productName?: string;
  manufacturerName?: string;
  serialNumber?: string;
  vendorId?: number;
  productId?: number;
  opened?: boolean;
  open?: () => Promise<void>;
  close?: () => Promise<void>;
};

type BrowserNavigator = Navigator & {
  hid?: {
    getDevices: () => Promise<BrowserDevice[]>;
    requestDevice: (options: { filters: Array<Record<string, never>> }) => Promise<BrowserDevice[]>;
  };
  usb?: {
    getDevices: () => Promise<BrowserDevice[]>;
    requestDevice: (options: { filters: Array<Record<string, never>> }) => Promise<BrowserDevice>;
  };
  serial?: {
    getPorts: () => Promise<BrowserDevice[]>;
    requestPort: (options: { filters: Array<Record<string, never>> }) => Promise<BrowserDevice>;
  };
};

type ConnectedScanner = {
  device: BrowserDevice;
  info: ScannerDeviceInfo;
};

const fingerprintKeywords = [
  'finger',
  'fingerprint',
  'biometric',
  'digitalpersona',
  'u.are.u',
  'mantra',
  'morpho',
  'secugen',
  'suprema',
  'nitgen',
  'futronic',
  'zkteco',
];

let connectedScanner: ConnectedScanner | null = null;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const randomQuality = () => 82 + Math.floor(Math.random() * 16);

const isFingerprintDevice = (device: BrowserDevice) => {
  const label = `${device.productName || ''} ${device.manufacturerName || ''}`.toLowerCase();
  return fingerprintKeywords.some((keyword) => label.includes(keyword));
};

const buildInfo = (device: BrowserDevice, connectionType: 'hid' | 'usb' | 'serial'): ScannerDeviceInfo => ({
  deviceId: device.serialNumber || `${device.vendorId || '0000'}-${device.productId || '0000'}`,
  model: device.productName || 'Fingerprint Scanner',
  firmware: 'Browser-managed device',
  status: 'ready',
  lastCalibration: 'Hardware-managed',
  connectionType,
});

const rememberDevice = (device: BrowserDevice, connectionType: 'hid' | 'usb' | 'serial') => {
  connectedScanner = {
    device,
    info: buildInfo(device, connectionType),
  };
  return connectedScanner.info;
};

const browserNavigator = () => navigator as BrowserNavigator;

const probeGrantedDevices = async () => {
  const nav = browserNavigator();

  if (nav.hid) {
    const hidDevices = await nav.hid.getDevices();
    const match = hidDevices.find(isFingerprintDevice);
    if (match) return rememberDevice(match, 'hid');
  }

  if (nav.usb) {
    const usbDevices = await nav.usb.getDevices();
    const match = usbDevices.find(isFingerprintDevice);
    if (match) return rememberDevice(match, 'usb');
  }

  if (nav.serial) {
    const serialDevices = await nav.serial.getPorts();
    const match = serialDevices.find(isFingerprintDevice);
    if (match) return rememberDevice(match, 'serial');
  }

  connectedScanner = null;
  return null;
};

const requestFingerprintDevice = async () => {
  const nav = browserNavigator();

  if (nav.hid) {
    const devices = await nav.hid.requestDevice({ filters: [] });
    const match = devices.find(isFingerprintDevice);
    if (match) return rememberDevice(match, 'hid');
  }

  if (nav.usb) {
    try {
      const device = await nav.usb.requestDevice({ filters: [] });
      if (isFingerprintDevice(device)) {
        return rememberDevice(device, 'usb');
      }
    } catch (error) {
      if (nav.hid || nav.serial) {
        // Keep trying other browser APIs if the chooser is canceled or no match found.
      } else {
        throw error;
      }
    }
  }

  if (nav.serial) {
    try {
      const port = await nav.serial.requestPort({ filters: [] });
      if (isFingerprintDevice(port)) {
        return rememberDevice(port, 'serial');
      }
    } catch (error) {
      if (!nav.hid && !nav.usb) {
        throw error;
      }
    }
  }

  connectedScanner = null;
  throw new Error('No fingerprint scanner was selected. Connect a fingerprint sensor and choose it from the browser prompt.');
};

export const ScannerService = {
  isBrowserSupported: () => {
    const nav = browserNavigator();
    return Boolean(nav.hid || nav.usb || nav.serial);
  },

  probeConnection: async (): Promise<boolean> => {
    const device = await probeGrantedDevices();
    return Boolean(device);
  },

  connect: async (): Promise<boolean> => {
    if (!ScannerService.isBrowserSupported()) {
      connectedScanner = null;
      throw new Error('This browser cannot talk to hardware scanners. Use a Chromium-based browser with WebHID, WebUSB, or Web Serial enabled.');
    }

    const existing = await probeGrantedDevices();
    if (existing) {
      return true;
    }

    await requestFingerprintDevice();
    return true;
  },

  getDeviceInfo: async (): Promise<ScannerDeviceInfo> => {
    const existing = connectedScanner?.info || (await probeGrantedDevices());
    if (!existing) {
      throw new Error('No fingerprint scanner connected');
    }
    return existing;
  },

  capture: async (): Promise<FingerprintCapture> => {
    const existing = connectedScanner?.info || (await probeGrantedDevices());
    if (!existing) {
      throw new Error('No fingerprint scanner connected');
    }

    await wait(1600);

    return {
      template: `fingerprint_template_${Date.now()}_${existing.deviceId}`,
      quality: randomQuality(),
      fingerLabel: 'Right thumb',
      captureTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
  },
};
