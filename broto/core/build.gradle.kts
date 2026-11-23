import org.jetbrains.kotlin.gradle.dsl.JvmTarget
plugins { kotlin("jvm") }
kotlin { compilerOptions { jvmTarget.set(JvmTarget.JVM_1_8); freeCompilerArgs.addAll("-Xlambdas=class", "-Xsam-conversions=class", "-Xstring-concat=inline", "-Xjdk-release=1.8") } }
java { sourceCompatibility = JavaVersion.VERSION_1_8; targetCompatibility = JavaVersion.VERSION_1_8 }
dependencies {
    testImplementation(kotlin("test"))
    testImplementation("junit:junit:4.13.2")
}
tasks.test { useJUnit() }
