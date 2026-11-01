import mysql from 'mysql2/promise'

export const pool = mysql.createPool({
    host: process.env.DB_HOST ?? 'localhost',
    user: process.env.DB_USER ?? 'seraphim',
    password: process.env.DB_PASSWORD ?? 'password',
    database: process.env.DB_NAME ?? 'seraphim_game',
    port: Number(process.env.DB_PORT ?? 3307),
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
})

export const db = {
    async query<T = any>(sql: string, params?: any[]): Promise<T[]> {
        const [rows] = await pool.execute(sql, params)
        return rows as T[]
    },

    async execute(sql: string, params?: any[]) {
        const [result] = await pool.execute(sql, params)
        return result
    },
}