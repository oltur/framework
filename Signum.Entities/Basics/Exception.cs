using System;
using System.Linq;
using Signum.Utilities;
using System.Threading;
using System.Collections.Specialized;
using System.Reflection;

namespace Signum.Entities.Basics
{
    [Serializable, EntityKind(EntityKind.System, EntityData.Transactional), TicksColumn(false)]
    public class ExceptionEntity : Entity
    {
        public const string ExceptionDataKey = "exceptionEntity";

#pragma warning disable CS8618 // Non-nullable field is uninitialized.
        public ExceptionEntity() { }

        public ExceptionEntity(Exception ex)
        {
            this.ExceptionType = ex.GetType().Name;
            this.ExceptionMessage = ex.Message!;
            this.StackTrace = ex.StackTrace!;
            this.ThreadId = Thread.CurrentThread.ManagedThreadId;
            ex.Data[ExceptionDataKey] = this;
            this.MachineName = System.Environment.MachineName;
            this.ApplicationName = AppDomain.CurrentDomain.FriendlyName;
        }
#pragma warning restore CS8618 // Non-nullable field is uninitialized.

        public DateTime CreationDate { get; private set; } = TimeZoneManager.Now;

        [ForceNotNullable, SqlDbType(Size = 100)]
        public string? ExceptionType { get; set; }

        [SqlDbType(Size = int.MaxValue)]
        string exceptionMessage;
        public string ExceptionMessage
        {
            get { return exceptionMessage; }
            set
            {
                if (Set(ref exceptionMessage, value))
                    ExceptionMessageHash = value == null ? 0 : value.GetHashCode();
            }
        }

        public int ExceptionMessageHash { get; private set; }

        [SqlDbType(Size = int.MaxValue)]
        string stackTrace;
        public string StackTrace
        {
            get { return stackTrace; }
            set
            {
                if (Set(ref stackTrace, value))
                    StackTraceHash = value == null ? 0 : value.GetHashCode();
            }
        }

        public int StackTraceHash { get; private set; }

        public int ThreadId { get; set; }

        public Lite<IUserEntity>? User { get; set; }

        [SqlDbType(Size = 100)]
        public string? Environment { get; set; }

        [SqlDbType(Size = 100)]
        public string? Version { get; set; }

        [SqlDbType(Size = 300)]
        public string? UserAgent { get; set; }

        [SqlDbType(Size = int.MaxValue)]
        public string? RequestUrl { get; set; }

        [SqlDbType(Size = 100)]
        public string? ControllerName { get; set; }

        [SqlDbType(Size = 100)]
        public string? ActionName { get; set; }

        [SqlDbType(Size = int.MaxValue)]
        public string? UrlReferer { get; set; }

        [SqlDbType(Size = 100)]
        public string? MachineName { get; set; }

        [SqlDbType(Size = 100)]
        public string? ApplicationName { get; set; }

        [SqlDbType(Size = 100)]
        public string? UserHostAddress { get; set; }

        [SqlDbType(Size = 100)]
        public string? UserHostName { get; set; }

        [SqlDbType(Size = int.MaxValue)]
        public string? Form { get; set; }

        [SqlDbType(Size = int.MaxValue)]
        public string? QueryString { get; set; }

        [SqlDbType(Size = int.MaxValue)]
        public string? Session { get; set; }

        [SqlDbType(Size = int.MaxValue)]
        public string? Data { get; set; }

        public int HResult { get; internal set; }

        public bool Referenced { get; set; }

        public override string ToString()
        {
            return "{0}: {1}".FormatWith(ExceptionType, exceptionMessage).Etc(200);
        }

        public static string Dump(NameValueCollection nameValueCollection)
        {
            return nameValueCollection.Cast<string>().ToString(key => key + ": " + nameValueCollection[key], "\r\n");
        }
    }


    [Serializable]
    public class DeleteLogParametersEmbedded : EmbeddedEntity
    {
        [PreserveOrder]
        [NoRepeatValidator]
        public MList<DeleteLogsTypeOverridesEmbedded> DeleteLogs { get; set; } = new MList<DeleteLogsTypeOverridesEmbedded>();

        public DateTime? GetDateLimitDelete(TypeEntity type)
        {
            var moreThan = DeleteLogs.SingleOrDefaultEx(a => a.Type.Is(type))?.DeleteLogsOlderThan;

            if (moreThan == null)
                return null;

            return moreThan == 0 ? TimeZoneManager.Now.TrimToHours() : TimeZoneManager.Now.Date.AddDays(-moreThan.Value);
        }

        public DateTime? GetDateLimitDeleteWithExceptions(TypeEntity type)
        {
            var moreThan = DeleteLogs.SingleOrDefaultEx(a => a.Type.Is(type))?.DeleteLogsWithExceptionsOlderThan;

            if (moreThan == null)
                return null;

            return moreThan.Value == 0 ? TimeZoneManager.Now.TrimToHours() : TimeZoneManager.Now.Date.AddDays(-moreThan.Value);
        }

        public int ChunkSize { get; set; } = 1000;

        public int MaxChunks { get; set; } = 20;

        [Unit("ms")]
        public int? PauseTime { get; set; } = 5000;
    }

#pragma warning disable CS8618 // Non-nullable field is uninitialized.
    [Serializable]
    public class DeleteLogsTypeOverridesEmbedded : EmbeddedEntity
    {
        public Lite<TypeEntity> Type { get; set; }

        [Unit("Days"), NumberIsValidator(ComparisonType.GreaterThanOrEqualTo, 0)]
        public int? DeleteLogsOlderThan { get; set; } = 30 * 6;

        [Unit("Days"), NumberIsValidator(ComparisonType.GreaterThanOrEqualTo, 0)]
        public int? DeleteLogsWithExceptionsOlderThan { get; set; } = 30 * 2;

        protected internal override string? PropertyValidation(PropertyInfo pi)
        {
            if (pi.Name == nameof(DeleteLogsOlderThan))
            {
                if (DeleteLogsOlderThan.HasValue && DeleteLogsWithExceptionsOlderThan.HasValue && DeleteLogsOlderThan.Value <= DeleteLogsWithExceptionsOlderThan.Value)
                    return ValidationMessage._0ShouldBeGreaterThan1.NiceToString(pi.NiceName(), NicePropertyName(() => DeleteLogsWithExceptionsOlderThan));
            }

            return base.PropertyValidation(pi);
        }
    }
#pragma warning restore CS8618 // Non-nullable field is uninitialized.
}
