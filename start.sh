#!/bin/bash
/Users/rocket/Documents/udp2raw_mp_binaries/udp2raw_mp_binaries -c -l0.0.0.0:4000 -r your.server.ip:4096 -k "yourpassword" --raw-mode faketcp > ~/udp2raw.log 2>&1 &
sudo wg-quick up wg0 >> ~/wireguard.log 2>&1
