package app.broto

import app.broto.data.BrotoDatabase
import app.broto.data.Repo
import org.robolectric.RuntimeEnvironment

/** Banco limpo para cada teste (o singleton sobrevive entre testes da mesma classe). */
object TestRepo {
    fun fresh(): Repo {
        Repo.reset()
        val app = RuntimeEnvironment.getApplication()
        app.deleteDatabase(BrotoDatabase.DB_NAME)
        return Repo.get(app)
    }
}
