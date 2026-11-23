package app.broto.data

import android.content.ContentProvider
import android.content.ContentValues
import android.content.Context
import android.database.Cursor
import android.database.MatrixCursor
import android.net.Uri
import android.os.ParcelFileDescriptor
import android.provider.OpenableColumns
import java.io.File
import java.io.FileNotFoundException

/**
 * Compartilhamento seguro de arquivos gerados (PDFs e backups), equivalente ao FileProvider.
 * Só expõe arquivos das pastas internas "reports" e "exports"; nunca o banco de dados.
 */
class FilesProvider : ContentProvider() {
    override fun onCreate() = true

    private fun resolve(uri: Uri): File {
        val ctx = context ?: throw FileNotFoundException()
        val seg = uri.pathSegments
        if (seg.size != 2) throw FileNotFoundException()
        val dir = when (seg[0]) { "reports" -> reportsDir(ctx); "exports" -> exportsDir(ctx); else -> throw FileNotFoundException() }
        val f = File(dir, seg[1]).canonicalFile
        if (f.parentFile != dir.canonicalFile || !f.exists()) throw FileNotFoundException()
        return f
    }

    override fun openFile(uri: Uri, mode: String): ParcelFileDescriptor = ParcelFileDescriptor.open(resolve(uri), ParcelFileDescriptor.MODE_READ_ONLY)

    override fun query(uri: Uri, projection: Array<out String>?, selection: String?, selectionArgs: Array<out String>?, sortOrder: String?): Cursor {
        val f = resolve(uri)
        val cols = projection ?: arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE)
        val c = MatrixCursor(cols)
        c.addRow(cols.map { when (it) { OpenableColumns.DISPLAY_NAME -> f.name; OpenableColumns.SIZE -> f.length(); else -> null } }.toTypedArray())
        return c
    }

    override fun getType(uri: Uri): String = if (uri.lastPathSegment?.endsWith(".pdf") == true) "application/pdf" else "application/json"
    override fun insert(uri: Uri, values: ContentValues?): Uri? = null
    override fun delete(uri: Uri, selection: String?, selectionArgs: Array<out String>?) = 0
    override fun update(uri: Uri, values: ContentValues?, selection: String?, selectionArgs: Array<out String>?) = 0

    companion object {
        const val AUTHORITY = "app.broto.files"
        fun reportsDir(ctx: Context) = File(ctx.filesDir, "reports").also { it.mkdirs() }
        fun exportsDir(ctx: Context) = File(ctx.cacheDir, "exports").also { it.mkdirs() }
        fun uriFor(kind: String, f: File): Uri = Uri.parse("content://$AUTHORITY/$kind/${Uri.encode(f.name)}")
    }
}
