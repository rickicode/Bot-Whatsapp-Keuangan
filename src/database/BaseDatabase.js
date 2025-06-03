// Base Database Interface
class BaseDatabase {
    constructor() {
        if (this.constructor === BaseDatabase) {
            throw new Error("Abstract class cannot be instantiated.");
        }
    }

    // Abstract methods that must be implemented by subclasses
    async initialize() {
        throw new Error("initialize() method must be implemented");
    }

    async close() {
        throw new Error("close() method must be implemented");
    }

    async run(sql, params = []) {
        throw new Error("run() method must be implemented");
    }

    async get(sql, params = []) {
        throw new Error("get() method must be implemented");
    }

    async all(sql, params = []) {
        throw new Error("all() method must be implemented");
    }

    async beginTransaction() {
        throw new Error("beginTransaction() method must be implemented");
    }

    async commit() {
        throw new Error("commit() method must be implemented");
    }

    async rollback() {
        throw new Error("rollback() method must be implemented");
    }
}

module.exports = BaseDatabase;