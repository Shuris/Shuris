import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins { kotlin("jvm") }

val androidJar = providers.environmentVariable("BROTO_ANDROID_JAR").orElse("/opt/android-stub/android.jar").get()
val buildToolsDir = providers.environmentVariable("BROTO_BUILD_TOOLS").orElse("/usr/lib/android-sdk/build-tools/debian").get()
val appVersionCode = 1
val appVersionName = "1.0.0"
val minSdk = 26
val targetSdk = 34

kotlin { compilerOptions { jvmTarget.set(JvmTarget.JVM_1_8); freeCompilerArgs.addAll("-Xlambdas=class", "-Xsam-conversions=class", "-Xstring-concat=inline") } }
java { sourceCompatibility = JavaVersion.VERSION_1_8; targetCompatibility = JavaVersion.VERSION_1_8 }

dependencies {
    compileOnly(files(androidJar))
    implementation(project(":core"))
}

val outDir = layout.buildDirectory.dir("apk")

val compileRes by tasks.registering(Exec::class) {
    val resDir = file("src/main/res")
    val out = outDir.get().file("res.zip").asFile
    inputs.dir(resDir); outputs.file(out)
    doFirst { out.parentFile.mkdirs() }
    commandLine("aapt2", "compile", "--dir", resDir.absolutePath, "-o", out.absolutePath)
}

val linkRes by tasks.registering(Exec::class) {
    dependsOn(compileRes)
    val manifest = file("src/main/AndroidManifest.xml")
    val assets = file("src/main/assets")
    val out = outDir.get().file("base.apk").asFile
    inputs.file(manifest); inputs.dir(assets); inputs.file(outDir.get().file("res.zip"))
    outputs.file(out)
    commandLine("aapt2", "link", "-I", androidJar, "--manifest", manifest.absolutePath,
        "-A", assets.absolutePath, "--min-sdk-version", "$minSdk", "--target-sdk-version", "$targetSdk",
        "--version-code", "$appVersionCode", "--version-name", appVersionName, "--auto-add-overlay",
        "--no-compress-regex", "\\.(ttf|otf)$",
        "-o", out.absolutePath, outDir.get().file("res.zip").asFile.absolutePath)
}

val stageClasses by tasks.registering(Sync::class) {
    dependsOn(tasks.named("jar"))
    from(configurations.runtimeClasspath.map { cp -> cp.files.map { if (it.isDirectory) it else zipTree(it) } })
    from(tasks.named<Jar>("jar").map { zipTree(it.archiveFile) })
    include("**/*.class")
    exclude("META-INF/**", "**/module-info.class")
    duplicatesStrategy = DuplicatesStrategy.EXCLUDE
    into(outDir.map { it.dir("classes") })
}

val dex by tasks.registering(Exec::class) {
    dependsOn(stageClasses)
    val classes = outDir.get().dir("classes").asFile
    val out = outDir.get().dir("dex").asFile
    inputs.dir(classes); outputs.dir(out)
    doFirst { out.deleteRecursively(); out.mkdirs() }
    executable = "dalvik-exchange"
    args("-JXmx3g", "--dex", "--min-sdk-version=$minSdk", "--multi-dex", "--output=${out.absolutePath}", classes.absolutePath)
}

val keystore = rootProject.file("keystore/broto-release.jks")

val ensureKeystore by tasks.registering(Exec::class) {
    onlyIf { !keystore.exists() }
    doFirst { keystore.parentFile.mkdirs() }
    commandLine("keytool", "-genkeypair", "-keystore", keystore.absolutePath, "-storepass", "broto-local",
        "-keypass", "broto-local", "-alias", "broto", "-keyalg", "RSA", "-keysize", "2048", "-validity", "10000",
        "-dname", "CN=Broto, OU=Pessoal, O=Broto, C=BR")
}

val assembleApk by tasks.registering {
    group = "build"
    description = "Gera o APK assinado em build/apk/broto.apk"
    dependsOn(linkRes, dex, ensureKeystore)
    val base = outDir.get().file("base.apk").asFile
    val dexDir = outDir.get().dir("dex").asFile
    val unaligned = outDir.get().file("unaligned.apk").asFile
    val aligned = outDir.get().file("aligned.apk").asFile
    val finalApk = outDir.get().file("broto-$appVersionName.apk").asFile
    outputs.file(finalApk)
    doLast {
        base.copyTo(unaligned, overwrite = true)
        val dexFiles = dexDir.listFiles { f -> f.name.endsWith(".dex") }!!.sortedBy { it.name }
        project.exec { workingDir = dexDir; commandLine(listOf("zip", "-q", "-j", unaligned.absolutePath) + dexFiles.map { it.absolutePath }) }
        aligned.delete()
        project.exec { commandLine("zipalign", "-f", "-p", "4", unaligned.absolutePath, aligned.absolutePath) }
        project.exec { commandLine("apksigner", "sign", "--ks", keystore.absolutePath, "--ks-pass", "pass:broto-local",
            "--ks-key-alias", "broto", "--min-sdk-version", "$minSdk", "--out", finalApk.absolutePath, aligned.absolutePath) }
        project.exec { commandLine("apksigner", "verify", "--min-sdk-version", "$minSdk", finalApk.absolutePath) }
        println("APK: ${finalApk.absolutePath} (${finalApk.length() / 1024} KB)")
    }
}

// ---------- Testes (Robolectric, sem dependências do Google Maven) ----------
dependencies {
    testCompileOnly(files(androidJar))
    testRuntimeOnly(files(androidJar))
    testImplementation("junit:junit:4.13.2")
    testImplementation(kotlin("test"))
    testImplementation("org.robolectric:robolectric:4.14.1") {
        exclude(group = "androidx.test")
        exclude(group = "androidx.test.espresso")
    }
}

val writeRobolectricConfig by tasks.registering {
    dependsOn(linkRes)
    val f = layout.buildDirectory.file("generated/testcfg/com/android/tools/test_config.properties")
    outputs.file(f)
    doLast {
        val out = f.get().asFile; out.parentFile.mkdirs()
        out.writeText("android_resource_apk=${outDir.get().file("base.apk").asFile.absolutePath}\nandroid_custom_package=app.broto\nandroid_merged_manifest=${file("src/main/AndroidManifest.xml").absolutePath}\n")
    }
}
sourceSets["test"].resources.srcDir(layout.buildDirectory.dir("generated/testcfg"))
tasks.named("processTestResources") { dependsOn(writeRobolectricConfig) }
tasks.test {
    useJUnit()
    systemProperty("robolectric.graphicsMode", "NATIVE")
    systemProperty("robolectric.offline", "false")
    systemProperty("robolectric.dependency.repo.url", "https://maven-central.storage-download.googleapis.com/maven2")
    systemProperty("broto.screenshots", layout.buildDirectory.dir("screenshots").get().asFile.absolutePath)
    maxHeapSize = "3g"
    testLogging { events("failed"); exceptionFormat = org.gradle.api.tasks.testing.logging.TestExceptionFormat.FULL; showStandardStreams = false }
}
