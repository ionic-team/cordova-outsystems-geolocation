package com.outsystems.plugins.geolocation

import android.Manifest
import android.content.pm.PackageManager
import android.webkit.WebView
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleOwner
import io.ionic.libs.iongeolocationlib.view.IONGLOCLocationButtonRegistry
import io.ionic.libs.iongeolocationlib.view.IONGLOCLocationButtonPermissionRequester
import io.ionic.libs.ionnativeislandslib.NativeIslandsBridgeValidationError
import io.ionic.libs.ionnativeislandslib.NativeIslandsBridgeValidator
import io.ionic.libs.ionnativeislandslib.NativeIslandsController
import org.apache.cordova.CallbackContext
import org.apache.cordova.CordovaPlugin
import org.apache.cordova.PermissionHelper
import org.apache.cordova.PluginResult
import org.json.JSONArray
import org.json.JSONObject

/** Internal Cordova bridge used by the Geolocation Location Button element. */
class OSGeolocationIslands : CordovaPlugin() {

    private lateinit var controller: NativeIslandsController
    private val pendingPermissionResults = mutableListOf<(Boolean) -> Unit>()
    private var permissionRequestInFlight = false

    @Volatile
    private var eventsChannel: CallbackContext? = null

    private val permissionRequester = IONGLOCLocationButtonPermissionRequester { callback ->
        cordova.activity.runOnUiThread {
            requestPreciseLocation(callback)
        }
    }

    override fun pluginInitialize() {
        IONGLOCLocationButtonRegistry.register(cordova.activity, permissionRequester)
        controller = NativeIslandsController { event, payload ->
            val channel = eventsChannel ?: return@NativeIslandsController
            val message = JSONObject().put("event", event).put("data", payload)
            channel.sendPluginResult(PluginResult(PluginResult.Status.OK, message).apply {
                keepCallback = true
            })
        }
        val lifecycle = (cordova.activity as? LifecycleOwner)?.lifecycle
        if (lifecycle?.currentState?.isAtLeast(Lifecycle.State.RESUMED) == true) {
            controller.onHostResume()
        } else {
            controller.onHostPause()
        }
        controller.bind(webView.view as WebView, cordova.activity)
        cordova.activity.runOnUiThread { controller.ensureContainer() }
    }

    override fun execute(action: String, args: JSONArray, callback: CallbackContext): Boolean {
        if (action !in SUPPORTED_ACTIONS) return false
        val envelope = args.opt(0) as? JSONObject
        if (envelope == null) {
            reject(callback, "invalid_request", "operation envelope must be an object")
            return true
        }

        return when (action) {
            "applyLayout" -> {
                if (!validate(callback, NativeIslandsBridgeValidator.validateLayoutOperation(envelope))) {
                    return true
                }
                val components = envelope.opt("components") as JSONArray
                val order = envelope.opt("order") as JSONArray
                val exclusions = envelope.opt("exclusions") as JSONObject
                val cutouts = envelope.opt("cutouts") as JSONObject
                val scrollContainers = envelope.opt("scrollContainers") as JSONArray
                val motionPresentation = envelope.optBoolean("motionPresentation", false)
                controller.validateLayout(
                    components,
                    order,
                    exclusions,
                    cutouts,
                    scrollContainers,
                    motionPresentation,
                )?.let { reason ->
                    reject(callback, "invalid_request", reason)
                    return true
                }
                controller.applyLayout(
                    components,
                    order,
                    exclusions,
                    cutouts,
                    scrollContainers,
                    motionPresentation,
                    failure = { code, message -> reject(callback, code, message) },
                ) { callback.success() }
                true
            }

            "applyScrollOffsets" -> {
                if (
                    !validate(
                        callback,
                        NativeIslandsBridgeValidator.validateScrollOffsetsOperation(envelope),
                    )
                ) {
                    return true
                }
                controller.applyScrollOffsets(
                    sequence = (envelope.opt("sequence") as Number).toLong(),
                    offsets = envelope.opt("offsets") as JSONArray,
                    settled = envelope.optBoolean("settled", false),
                    failure = { code, message -> reject(callback, code, message) },
                ) { callback.success() }
                true
            }

            "command" -> {
                if (!validate(callback, NativeIslandsBridgeValidator.validateCommandOperation(envelope))) {
                    return true
                }
                val params = envelope.opt("params") as? JSONObject ?: JSONObject()
                controller.dispatchCommand(
                    (envelope.opt("protocolVersion") as Number).toInt(),
                    envelope.opt("island") as String,
                    envelope.opt("islandType") as String,
                    envelope.opt("method") as String,
                    jsonToMap(params),
                ) { result ->
                    val code = result.optString("code")
                    if (code.isNotEmpty()) {
                        reject(callback, code, result.optString("error", code))
                    } else {
                        callback.success()
                    }
                }
                true
            }

            "reset" -> {
                if (!validate(callback, NativeIslandsBridgeValidator.validateOperation("reset", envelope))) {
                    return true
                }
                controller.reset()
                callback.success()
                true
            }

            "events" -> {
                if (!validate(callback, NativeIslandsBridgeValidator.validateOperation("events", envelope))) {
                    return true
                }
                closeEventsChannel()
                eventsChannel = callback
                callback.sendPluginResult(PluginResult(PluginResult.Status.NO_RESULT).apply {
                    keepCallback = true
                })
                true
            }

            else -> error("unreachable")
        }
    }

    private fun requestPreciseLocation(callback: (Boolean) -> Unit) {
        if (PermissionHelper.hasPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)) {
            callback(true)
            return
        }

        pendingPermissionResults += callback
        if (permissionRequestInFlight) return

        permissionRequestInFlight = true
        try {
            PermissionHelper.requestPermissions(
                this,
                LOCATION_BUTTON_PERMISSION_REQUEST_CODE,
                arrayOf(
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION,
                ),
            )
        } catch (_: RuntimeException) {
            completePermissionRequest(false)
        }
    }

    override fun onRequestPermissionResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray,
    ) {
        if (requestCode != LOCATION_BUTTON_PERMISSION_REQUEST_CODE) return
        val fineIndex = permissions.indexOf(Manifest.permission.ACCESS_FINE_LOCATION)
        val fineGranted =
            fineIndex >= 0 &&
                fineIndex < grantResults.size &&
                grantResults[fineIndex] == PackageManager.PERMISSION_GRANTED
        completePermissionRequest(fineGranted)
    }

    private fun completePermissionRequest(granted: Boolean) {
        permissionRequestInFlight = false
        val callbacks = pendingPermissionResults.toList()
        pendingPermissionResults.clear()
        callbacks.forEach { callback -> callback(granted) }
    }

    private fun validate(
        callback: CallbackContext,
        error: NativeIslandsBridgeValidationError?,
    ): Boolean =
        if (error == null) {
            true
        } else {
            reject(callback, error.code, error.message)
            false
        }

    private fun reject(callback: CallbackContext, code: String, message: String) {
        callback.error(JSONObject().put("code", code).put("message", message))
    }

    private fun jsonToMap(json: JSONObject): Map<String, Any?> {
        val map = HashMap<String, Any?>()
        val keys = json.keys()
        while (keys.hasNext()) {
            val key = keys.next()
            map[key] = normalizeJSON(json.opt(key))
        }
        return map
    }

    private fun normalizeJSON(value: Any?): Any? = when (value) {
        null, JSONObject.NULL -> null
        is JSONObject -> jsonToMap(value)
        is JSONArray -> (0 until value.length()).map { normalizeJSON(value.opt(it)) }
        else -> value
    }

    private fun closeEventsChannel() {
        val channel = eventsChannel ?: return
        eventsChannel = null
        channel.sendPluginResult(PluginResult(PluginResult.Status.NO_RESULT).apply {
            keepCallback = false
        })
    }

    override fun onReset() {
        closeEventsChannel()
        controller.reset()
        pendingPermissionResults.clear()
    }

    override fun onResume(multitasking: Boolean) {
        controller.onHostResume()
    }

    override fun onPause(multitasking: Boolean) {
        controller.onHostPause()
    }

    override fun onDestroy() {
        closeEventsChannel()
        pendingPermissionResults.clear()
        permissionRequestInFlight = false
        controller.dispose()
        IONGLOCLocationButtonRegistry.unregister(cordova.activity)
    }

    companion object {
        private const val LOCATION_BUTTON_PERMISSION_REQUEST_CODE = 22333
        private val SUPPORTED_ACTIONS =
            setOf("applyLayout", "applyScrollOffsets", "command", "reset", "events")
    }
}
