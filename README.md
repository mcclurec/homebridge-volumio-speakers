
<p align="center">
<img src="https://github.com/homebridge/branding/raw/master/logos/homebridge-wordmark-logo-vertical.png" width="150">
</p>


# Homebridge Volumio Speakers

Add your Volumio zones to Apple Homekit. This platform plugin uses the [SmartSpeaker](https://developers.homebridge.io/#/service/SmartSpeaker) service to automatically create accessories from
all your Volumio zones that show up as real speakers in Homekit. 

## Functionality

**You must have iOS 13.4 or later.**

All your zones (non-private) will show up in Homekit (after you add them one by one, see instructions below).

Currently the `SmartSpeaker` service is extremely limited and it only has the following functionality:

- Showing the current status of each output (Playing, paused, or stopped).
- Pausing/playing each output (unless that output is stopped).

However the `SmartSpeaker` service does show some promise. Although it is all based on Airplay 2, there is a chance (if
somewhat slim) that we'll also be able to control volume and other transport controls later on.

## Installation

Install via NPM globally:

```
sudo npm install -g --unsafe-perm homebridge-volumio-speakers
```

Alternatively you can install this through [Homebridge Config UI X](https://www.npmjs.com/package/homebridge-config-ui-x). Just search for `homebridge-volumio-speakers`.

Take a look at the [Homebridge Wiki](https://github.com/homebridge/homebridge/wiki) for help installing Homebridge if you
haven't already.

## Configuration

Use the Homebridge Config UI X `Settings` link, or add the `Volumio Speakers` platform manually to your `config.json`:

```json
{
    "platforms": [
        {
            "platform": "Volumio Speakers",
            "serverURL": "http://volumio.local"
        }
    ]
}
```

You can use the following options in your homebridge config:

Variable | Optional/Required | Description
-------- | ----------------- | -----------
`platform` | **required** | Must be `Volumio Speakers`.
`serverURL` | **required** | The url of one of your Volumio servers. Other servers/zones will be auto discovered from there.

## How to use

Once configured, restart Homebridge and keep an eye on the logs.

Then in the Homebridge logs, you should see all your zones get accessories created for them.

The final step is to add each output accessory to Homekit, manually. To do this:
 
1. In Homekit on iOS go to "Add accessory"
2. Then hit "I Don't Have a Code or Cannot Scan"
3. You should see all your outputs listed on "Nearby Accessories"
4. Hit the first one, then hit "Add anyway", then enter the code provided by Homebridge (check your Homebridge logs).
5. On the final screen, just hit "Done". You can now add the speaker to one of your rooms by long pressing it and using the edit cog.
6. Repeat for each zone.
