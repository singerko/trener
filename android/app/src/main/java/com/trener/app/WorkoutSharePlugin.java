package com.trener.app;

import android.content.Intent;
import android.net.Uri;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;

@CapacitorPlugin(name = "WorkoutShare")
public class WorkoutSharePlugin extends Plugin {
    @PluginMethod
    public void shareWorkout(PluginCall call) {
        String fileName = call.getString("fileName");
        String content = call.getString("content");
        String title = call.getString("title", "Zdieľať tréning");
        String text = call.getString("text", "");

        if (fileName == null || fileName.trim().isEmpty()) {
            call.reject("Chýba názov súboru");
            return;
        }
        if (content == null) {
            call.reject("Chýba obsah exportu");
            return;
        }

        try {
            File exportDir = new File(getContext().getCacheDir(), "workout-exports");
            if (!exportDir.exists() && !exportDir.mkdirs()) {
                call.reject("Nepodarilo sa pripraviť exportný adresár");
                return;
            }

            File exportFile = new File(exportDir, fileName);
            try (FileOutputStream outputStream = new FileOutputStream(exportFile)) {
                outputStream.write(content.getBytes(StandardCharsets.UTF_8));
            }

            Uri uri = FileProvider.getUriForFile(
                getContext(),
                getContext().getPackageName() + ".fileprovider",
                exportFile
            );

            Intent shareIntent = new Intent(Intent.ACTION_SEND);
            shareIntent.setType("application/json");
            shareIntent.putExtra(Intent.EXTRA_STREAM, uri);
            shareIntent.putExtra(Intent.EXTRA_SUBJECT, title);
            shareIntent.putExtra(Intent.EXTRA_TEXT, text);
            shareIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

            Intent chooser = Intent.createChooser(shareIntent, title);
            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(chooser);

            JSObject result = new JSObject();
            result.put("uri", uri.toString());
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Zdieľanie tréningu zlyhalo", error);
        }
    }
}
