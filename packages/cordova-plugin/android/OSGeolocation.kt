package com.outsystems.plugins.geolocation

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.util.Log
import androidx.activity.result.contract.ActivityResultContracts
import com.google.gson.Gson
import io.ionic.libs.iongeolocationlib.controller.IONGLOCController
import io.ionic.libs.iongeolocationlib.model.IONGLOCException
import io.ionic.libs.iongeolocationlib.model.IONGLOCLocationOptions
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.launch
import org.apache.cordova.CallbackContext
import org.apache.cordova.CordovaPlugin
import org.apache.cordova.PermissionHelper
import org.apache.cordova.PluginResult
import org.json.JSONArray
import org.json.JSONObject

/**
 * Cordova bridge, inherits from CordovaPlugin
 */
class OSGeolocation : CordovaPlugin() {

    private lateinit var controller: IONGLOCController
    private val gson by lazy { Gson() }

    // for permissions
    private lateinit var permissionsFlow: MutableSharedFlow<OSGeolocationPermissionEvents>
    private lateinit var coroutineScope: CoroutineScope

    companion object {
        private const val LOCATION_PERMISSIONS_REQUEST_CODE = 22332
        private const val ID = "id"
        private const val TIMEOUT = "timeout"
        private const val MAXIMUM_AGE = "maximumAge"
        private const val ENABLE_HIGH_ACCURACY = "enableHighAccuracy"
        private const val ENABLE_FALLBACK = "enableLocationFallback"
        private const val LOG_TAG = "OSGeolocation"
    }

    override fun pluginInitialize() {
        super.pluginInitialize()

        coroutineScope = CoroutineScope(Dispatchers.Main)
        val activityLauncher = cordova.activity.registerForActivityResult(
            ActivityResultContracts.StartIntentSenderForResult()
        ) { result ->
            coroutineScope.launch {
                controller.onResolvableExceptionResult(result.resultCode)
            }
        }

        this.controller = IONGLOCController(cordova.context, activityLauncher)
    }

    override fun onDestroy() {
        super.onDestroy()
        coroutineScope.cancel()
    }

    override fun execute(
        action: String,
        args: JSONArray,
        callbackContext: CallbackContext
    ): Boolean {
        when (action) {
            "getCurrentPosition" -> {
                getCurrentPosition(args, callbackContext)
            }

            "watchPosition" -> {
                watchPosition(args, callbackContext)
            }

            "clearWatch" -> {
                clearWatch(args, callbackContext)
            }

            "hasNativeTimeoutHandling" -> {
                hasNativeTimeoutHandling(callbackContext)
            }
        }
        return true
    }

    /**
     * Calls the getCurrentPosition method of OSGeolocationController to get the device's geolocation
     * @param args JSONArray that contains the parameters to parse (e.g. timeout)
     * @param callbackContext CallbackContext the method should return to
     */
    private fun getCurrentPosition(args: JSONArray, callbackContext: CallbackContext) {
        val options: JSONObject
        try {
            options = args.getJSONObject(0)
        } catch (_: Exception) {
            callbackContext.sendError(OSGeolocationErrors.INVALID_INPUT_GET_POSITION)
            return
        }

        coroutineScope.launch {
            val locationOptions = IONGLOCLocationOptions(
                options.getLong(TIMEOUT),
                options.getLong(MAXIMUM_AGE),
                options.getBoolean(ENABLE_HIGH_ACCURACY),
                enableLocationManagerFallback = options.optBoolean(ENABLE_FALLBACK, true)
            )
            handleLocationPermission(callbackContext, locationOptions.enableHighAccuracy) {
                val locationResult =
                    controller.getCurrentPosition(cordova.activity, locationOptions)

                if (locationResult.isSuccess) {
                    callbackContext.sendSuccess(JSONObject(gson.toJson(locationResult.getOrNull())))
                } else {
                    handleErrors(locationResult.exceptionOrNull(), callbackContext)
                }
            }
        }
    }

    /**
     * Calls the addWatch method of OSGeolocationController to start watching the device's geolocation
     * @param args JSONArray that contains the parameters to parse (e.g. timeout)
     * @param callbackContext CallbackContext the method should return to
     */
    private fun watchPosition(args: JSONArray, callbackContext: CallbackContext) {
        val options: JSONObject
        try {
            options = args.getJSONObject(0)
        } catch (_: Exception) {
            callbackContext.sendError(OSGeolocationErrors.INVALID_INPUT_WATCH_POSITION)
            return
        }
        val watchId = options.getString(ID)

        coroutineScope.launch {
            val locationOptions = IONGLOCLocationOptions(
                timeout = options.getLong(TIMEOUT),
                maximumAge = options.getLong(MAXIMUM_AGE),
                enableHighAccuracy = options.getBoolean(ENABLE_HIGH_ACCURACY),
                enableLocationManagerFallback = options.optBoolean(ENABLE_FALLBACK, true)
            )
            handleLocationPermission(callbackContext, locationOptions.enableHighAccuracy) {
                controller.addWatch(cordova.activity, locationOptions, watchId).collect { result ->
                    result.onSuccess { locationList ->
                        locationList.forEach { locationResult ->
                            callbackContext.sendSuccess(
                                result = JSONObject(gson.toJson(locationResult)),
                                keepCallback = true
                            )
                        }
                    }
                    result.onFailure { exception ->
                        handleErrors(exception, callbackContext)
                    }
                }
            }
        }

    }

    /**
     * Helper function to handle errors from getCurrentPosition and watchPosition
     * @param exception Throwable exception to handle
     * @param callbackContext CallbackContext to use when sending the error callback
     */
    private fun handleErrors(
        exception: Throwable?,
        callbackContext: CallbackContext
    ) {
        when (exception) {
            is IONGLOCException.IONGLOCRequestDeniedException -> {
                callbackContext.sendError(OSGeolocationErrors.LOCATION_ENABLE_REQUEST_DENIED)
            }

            is IONGLOCException.IONGLOCSettingsException -> {
                callbackContext.sendError(OSGeolocationErrors.LOCATION_SETTINGS_ERROR)
            }

            is IONGLOCException.IONGLOCLocationAndNetworkDisabledException -> {
                callbackContext.sendError(OSGeolocationErrors.NETWORK_LOCATION_DISABLED_ERROR)
            }

            is IONGLOCException.IONGLOCInvalidTimeoutException -> {
                callbackContext.sendError(OSGeolocationErrors.INVALID_TIMEOUT)
            }

            is IONGLOCException.IONGLOCGoogleServicesException -> {
                if (exception.resolvable) {
                    callbackContext.sendError(OSGeolocationErrors.GOOGLE_SERVICES_RESOLVABLE)
                } else {
                    callbackContext.sendError(OSGeolocationErrors.GOOGLE_SERVICES_ERROR)
                }
            }

            is IONGLOCException.IONGLOCLocationRetrievalTimeoutException -> {
                callbackContext.sendError(OSGeolocationErrors.GET_LOCATION_TIMEOUT)
            }

            else -> {
                callbackContext.sendError(OSGeolocationErrors.POSITION_UNAVAILABLE)
            }
        }
    }

    /**
     * Calls the addWatch method of OSGeolocationController to stop watching the device's geolocation
     * @param args JSONArray that contains the parameters to parse (e.g. timeout)
     * @param callbackContext CallbackContext the method should return to
     */
    private fun clearWatch(args: JSONArray, callbackContext: CallbackContext) {
        val options: JSONObject
        try {
            options = args.getJSONObject(0)
        } catch (_: Exception) {
            callbackContext.sendError(OSGeolocationErrors.INVALID_INPUT_CLEAR_WATCH)
            return
        }
        val id = options.optString(ID)
        if (id.isNullOrBlank()) {
            callbackContext.sendError(OSGeolocationErrors.WATCH_ID_NOT_PROVIDED)
            return
        }
        val watchCleared = controller.clearWatch(id)
        if (watchCleared) {
            callbackContext.sendSuccess()
        } else {
            callbackContext.sendError(OSGeolocationErrors.WATCH_ID_NOT_FOUND)
        }
    }

    /**
     * Indicates whether the native geolocation implementation provides its own timeout handling.
     * Returns true if the plugin version supports native timeout handling.
     * @param callbackContext CallbackContext the method should return to
     */
    private fun hasNativeTimeoutHandling(callbackContext: CallbackContext) {
        val pluginResult = PluginResult(PluginResult.Status.OK, true)
        callbackContext.sendPluginResult(pluginResult)
    }

    /**
     * Extension function to return a successful plugin result
     * @param result JSONObject with the JSON content to return, or null if there's no JSON data
     * @param keepCallback whether the callback should be kept or not. By default, false
     */
    private fun CallbackContext.sendSuccess(
        result: JSONObject? = null,
        keepCallback: Boolean = false
    ) {
        val pluginResult = if (result != null) {
            PluginResult(PluginResult.Status.OK, result)
        } else {
            PluginResult(PluginResult.Status.OK)
        }
        pluginResult.keepCallback = keepCallback
        this.sendPluginResult(pluginResult)
    }

    /**
     * Extension function to return an unsuccessful plugin result
     * @param error error class representing the error to return, containing a code and message
     */
    private fun CallbackContext.sendError(error: OSGeolocationErrors.ErrorInfo) {
        val pluginResult = PluginResult(
            PluginResult.Status.ERROR,
            JSONObject().apply {
                put("code", error.code)
                put("message", error.message)
            }
        )
        this.sendPluginResult(pluginResult)
    }

    /**
     * Helper function to handle the location permission request using a Flow
     * @param callbackContext CallbackContext to use in case an error should be returned
     * @param enableHighAccuracy true if meant to do a high accuracy location request, false otherwise
     * @param onLocationGranted callback to use in case permissions are granted
     */
    private suspend fun handleLocationPermission(
        callbackContext: CallbackContext,
        enableHighAccuracy: Boolean,
        onLocationGranted: suspend () -> Unit
    ) {
        permissionsFlow = MutableSharedFlow(replay = 1)

        // first, we request permissions if necessary
        val permissions = getDeclaredPermissions(enableHighAccuracy)
        if (permissions.isEmpty()) {
            callbackContext.sendError(OSGeolocationErrors.LOCATION_MANIFEST_PERMISSIONS_MISSING)
            return
        }
        if (hasLocationPermissions(permissions)) {
            permissionsFlow.emit(OSGeolocationPermissionEvents.Granted)
        } else { // request necessary permissions
            requestLocationPermissions(permissions)
        }

        // collect the flow to handle permission request result
        permissionsFlow.collect { permissionEvent ->
            if (permissionEvent == OSGeolocationPermissionEvents.Granted) {
                onLocationGranted()
            } else {
                callbackContext.sendError(OSGeolocationErrors.LOCATION_PERMISSIONS_DENIED)
            }
        }
    }

    /**
     * Helper function to determine Location permission state
     * @return Boolean indicating if permissions are granted or not
     */
    private fun hasLocationPermissions(permissions: Array<String>): Boolean {
        for (permission in permissions) {
            if (!PermissionHelper.hasPermission(this, permission)) {
                return false
            }
        }
        return true
    }

    /**
     * Helper function to request location permissions
     */
    private fun requestLocationPermissions(permissions: Array<String>) {
        PermissionHelper.requestPermissions(
            this,
            LOCATION_PERMISSIONS_REQUEST_CODE,
            permissions
        )
    }

    /**
     * Get the location permissions to request based on the ones declared in app's manifest.
     *
     * @param enableHighAccuracy true if meant to do a high accuracy location request, false otherwise
     *
     * @return the array of declared location permissions, expected size 0-2
     */
    private fun getDeclaredPermissions(enableHighAccuracy: Boolean): Array<String> {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
            // Below Android 12 there is no FINE/COARSE distinction, so always request both.
            return arrayOf(
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.ACCESS_COARSE_LOCATION
            )
        }

        // On Android >= 12, only request what is declared in the manifest and needed for the accuracy level.
        val manifestPermissions = getManifestPermissions()
        // ACCESS_FINE_LOCATION implicitly grants coarse access, so a FINE-only manifest still covers COARSE.
        val hasFine = Manifest.permission.ACCESS_FINE_LOCATION in manifestPermissions
        val hasCoarse = hasFine || Manifest.permission.ACCESS_COARSE_LOCATION in manifestPermissions

        val permissions = mutableSetOf<String>()
        if (hasFine && enableHighAccuracy) permissions.add(Manifest.permission.ACCESS_FINE_LOCATION)
        if (hasCoarse) permissions.add(Manifest.permission.ACCESS_COARSE_LOCATION)
        return permissions.toTypedArray()
    }

    /**
     * Returns the set of permissions declared in the app's manifest.
     */
    private fun getManifestPermissions(): Set<String> {
        return try {
            val packageInfo = cordova.activity.packageManager.getPackageInfo(
                cordova.activity.packageName, PackageManager.GET_PERMISSIONS
            )
            (packageInfo.requestedPermissions ?: emptyArray()).toHashSet()
        } catch (e: Exception) {
            Log.d(LOG_TAG, e.message.toString())
            emptySet()
        }
    }

    /**
     * Still calling deprecated onRequestPermissionResult instead of onRequestPermissionsResult
     * Because cordova-android had a bug where onRequestPermissionsResult was not called
     * Fixed in https://github.com/apache/cordova-android/pull/1855
     * But existing MABS versions do not have that PR yet in the cordova-android fork
     * https://github.com/OutSystems/cordova-android
     * (particularly outsystems/14.0.x and outsystems/13.0.x branches)
     * so we'll have to wait until we can change to onRequestPermissionsResult here.
     */
    override fun onRequestPermissionResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        if (requestCode == LOCATION_PERMISSIONS_REQUEST_CODE) {
            coroutineScope.launch {
                permissionsFlow.emit(
                    if (grantResults.contains(PackageManager.PERMISSION_GRANTED)) {
                        OSGeolocationPermissionEvents.Granted
                    } else {
                        OSGeolocationPermissionEvents.NotGranted
                    }
                )
            }
        }
    }

}