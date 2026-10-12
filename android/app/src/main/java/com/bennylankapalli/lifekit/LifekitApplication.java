package com.bennylankapalli.lifekit;

import android.app.Application;

/**
 * The application object, which exists for two reasons:
 *
 *  1. it installs {@link CrashLog} before any activity starts, so a failure during launch is
 *     recorded and can be shown to the user on the next start instead of vanishing;
 *  2. it is the one place with an application-wide Context, which that recorder needs.
 */
public class LifekitApplication extends Application {

    @Override
    public void onCreate() {
        super.onCreate();
        CrashLog.install(this);
    }
}
